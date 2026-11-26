import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { audit, type StaffContext } from './access'

const UUID = /^[0-9a-f-]{36}$/i

const page = (url: URL) => ({
  limit: Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200),
  offset: Math.max(Number(url.searchParams.get('offset')) || 0, 0),
})

/** Find members, venue partners and staff. Needs `users.read`. */
export async function searchUsers(url: URL) {
  const { limit, offset } = page(url)
  const q = url.searchParams.get('q')?.trim().toLowerCase().slice(0, 80) ?? ''
  const role = url.searchParams.get('role')
  const status = url.searchParams.get('status')
  const identity = url.searchParams.get('identity')
  if (role && !['member', 'partner', 'admin', 'tester'].includes(role)) throw new ApiError(400, 'invalid_request', 'Unknown role.')
  if (status && !['active', 'suspended'].includes(status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')
  const db = await getDb()
  const params: unknown[] = []
  const where: string[] = []
  const add = (sql: string, v: unknown) => {
    params.push(v)
    where.push(sql.replace(/\?/g, `$${params.length}`))
  }
  if (q) add('(lower(u.email) like ? or lower(u.username) like ?)', `%${q}%`)
  if (role) add('u.role = ?', role)
  if (status) add('u.status = ?', status)
  if (identity === 'verified') where.push('u.identity_verified_at is not null')
  if (identity === 'unverified') where.push(`u.identity_verified_at is null and u.role = 'member'`)
  const sql = where.length ? `where ${where.join(' and ')}` : ''
  const { rows } = await db.query<{ id: string; email: string; username: string; role: string; status: string; email_verified_at: Date | null; identity_verified_at: Date | null; last_login_at: Date | null; created_at: Date }>(
    `select u.id, u.email, u.username, u.role, u.status, u.email_verified_at, u.identity_verified_at, u.last_login_at, u.created_at
       from users u ${sql} order by u.created_at desc limit ${limit} offset ${offset}`,
    params,
  )
  const total = (await db.query<{ n: number }>(`select count(*)::int as n from users u ${sql}`, params)).rows[0].n
  return {
    total,
    users: rows.map((r) => ({ id: r.id, email: r.email, username: r.username, role: r.role, status: r.status, emailVerified: Boolean(r.email_verified_at), identityVerified: Boolean(r.identity_verified_at), lastSignIn: r.last_login_at?.toISOString() ?? null, joined: r.created_at.toISOString() })),
  }
}

/** One account, with each section shown only if the viewer's role covers it. */
export async function userDetail(ctx: StaffContext, id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such user.')
  const db = await getDb()
  const u = (
    await db.query<{ id: string; email: string; username: string; role: string; status: string; email_verified_at: Date | null; identity_verified_at: Date | null; last_login_at: Date | null; created_at: Date }>(
      'select id, email, username, role, status, email_verified_at, identity_verified_at, last_login_at, created_at from users where id = $1',
      [id],
    )
  ).rows[0]
  if (!u) throw new ApiError(404, 'not_found', 'No such user.')
  const out: Record<string, unknown> = {
    user: { id: u.id, email: u.email, username: u.username, role: u.role, status: u.status, emailVerified: Boolean(u.email_verified_at), identityVerified: Boolean(u.identity_verified_at), lastSignIn: u.last_login_at?.toISOString() ?? null, joined: u.created_at.toISOString() },
    sections: [] as string[],
  }
  const sections = out.sections as string[]
  const sessions = (await db.query<{ n: number }>('select count(*)::int as n from sessions where user_id = $1 and revoked_at is null and expires_at > now()', [id])).rows[0].n
  ;(out.user as Record<string, unknown>).activeSessions = sessions
  if (ctx.can('kyc.read')) {
    sections.push('kyc')
    out.identity = (await db.query(`select provider, idp, over18, verified_at from identities where user_id = $1`, [id])).rows[0] ?? null
    out.kycCases = (await db.query(`select id, status, reason, decision_note, created_at, decided_at from kyc_cases where user_id = $1 order by created_at desc`, [id])).rows
  }
  if (ctx.can('bookings.read')) {
    sections.push('bookings')
    out.bookings = (
      await db.query(
        `select b.id, b.ref, b.status, b.kind, to_char(b.date_on, 'YYYY-MM-DD') as date_on, b.start_time, v.name as venue
           from bookings b left join venues v on v.id = b.venue_id where (b.user_a = $1 or b.user_b = $1) and not b.is_test order by b.created_at desc limit 20`,
        [id],
      )
    ).rows
    out.dateStats = (
      await db.query(
        `select count(*) filter (where status = 'ended')::int as dates, count(*) filter (where status = 'no_show' and no_show_user = $1)::int as no_shows,
                count(*) filter (where late_cancel and cancelled_by = $1)::int as late_cancels
           from bookings where (user_a = $1 or user_b = $1) and not is_test`,
        [id],
      )
    ).rows[0]
  }
  if (ctx.can('support.read')) {
    sections.push('support')
    out.tickets = (await db.query(`select id, ref, subject, status, priority, created_at from support_tickets where requester_id = $1 order by created_at desc limit 20`, [id])).rows
  }
  if (u.role === 'partner' && ctx.can('venues.review')) {
    sections.push('venue')
    out.venues = (await db.query(`select v.id, v.name, v.review_status, v.status, s.role from venue_staff s join venues v on v.id = s.venue_id where s.user_id = $1`, [id])).rows
  }
  return out
}

export async function setAccountStatus(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such user.')
  const status = body.status
  if (status !== 'active' && status !== 'suspended') throw new ApiError(400, 'invalid_request', 'Status must be active or suspended.')
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  if (status === 'suspended' && !reason) throw new ApiError(400, 'reason_required', 'Say why the account is being suspended.')
  if (id === ctx.userId) throw new ApiError(400, 'invalid_request', 'You cannot change your own account here.')
  const db = await getDb()
  await db.tx(async (q) => {
    const u = (await q.query<{ role: string }>('select role from users where id = $1 for update', [id])).rows[0]
    if (!u) throw new ApiError(404, 'not_found', 'No such user.')
    if (u.role === 'admin') throw new ApiError(403, 'forbidden', 'Staff accounts are managed on the Team page.')
    await q.query('update users set status = $2, updated_at = now() where id = $1', [id, status])
    if (status === 'suspended') await q.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
    await audit(q, ctx, req, status === 'suspended' ? 'user.suspended' : 'user.reactivated', { type: 'user', id }, { reason })
  })
  return { ok: true as const }
}

export async function signOutEverywhere(ctx: StaffContext, req: Request, id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such user.')
  const db = await getDb()
  await db.tx(async (q) => {
    const r = await q.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null returning id', [id])
    await audit(q, ctx, req, 'user.signed_out', { type: 'user', id }, { sessions: r.rows.length })
  })
  return { ok: true as const }
}
