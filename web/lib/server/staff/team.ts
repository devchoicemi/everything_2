import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { INVITE_TTL_DAYS } from '../auth/config'
import { sendMail, staffInviteMail } from '../auth/mailer'
import { rateLimit } from '../auth/rateLimit'
import { normalizeEmail } from '../auth/validate'
import { createInvite } from '../auth/waitlist'
import { ROLE_LABEL, ROLE_PERMISSIONS, ROLE_SUMMARY, STAFF_ROLES, audit, type StaffContext, type StaffRole } from './access'

const UUID = /^[0-9a-f-]{36}$/i

const parseRole = (v: unknown): StaffRole => {
  if (typeof v !== 'string' || !(STAFF_ROLES as readonly string[]).includes(v)) throw new ApiError(400, 'invalid_role', 'Choose a role from the list.')
  return v as StaffRole
}

export function roleCatalog() {
  return STAFF_ROLES.map((r) => ({ role: r, label: ROLE_LABEL[r], summary: ROLE_SUMMARY[r], permissions: ROLE_PERMISSIONS[r] }))
}

export async function listStaff() {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; email: string; username: string; role: StaffRole; active: boolean; last_login_at: Date | null; created_at: Date }>(
    `select u.id, u.email, u.username, s.role, s.active, u.last_login_at, s.created_at from staff s join users u on u.id = s.user_id order by s.created_at`,
  )
  const invited = await db.query<{ email: string; staff_role: StaffRole; expires_at: Date }>(`select email, staff_role, expires_at from invites where role = 'staff' and used_at is null and expires_at > now() order by created_at`)
  return {
    staff: rows.map((r) => ({ id: r.id, email: r.email, username: r.username, role: r.role, roleLabel: ROLE_LABEL[r.role], active: r.active, lastSignIn: r.last_login_at?.toISOString() ?? null, since: r.created_at.toISOString() })),
    invited: invited.rows.map((r) => ({ email: r.email, role: r.staff_role, roleLabel: ROLE_LABEL[r.staff_role], expiresAt: r.expires_at.toISOString() })),
    roles: roleCatalog(),
  }
}

export async function inviteStaff(ctx: StaffContext, req: Request, body: Record<string, unknown>) {
  await rateLimit('staff-invite', ctx.userId ?? 'token', 200, 3600)
  const email = normalizeEmail(body.email)
  const role = parseRole(body.role)
  const db = await getDb()
  if ((await db.query('select 1 from users where email = $1', [email])).rows.length) {
    throw new ApiError(409, 'email_taken', 'That email already has a ChoiceMi account. Staff use a separate account from members and venues.')
  }
  const token = await db.tx(async (q) => {
    const t = await createInvite(q, email, { role: 'staff', staffRole: role })
    await audit(q, ctx, req, 'staff.invited', { type: 'invite', id: email }, { role })
    return t
  })
  const sent = await sendMail(staffInviteMail(email, token, ROLE_LABEL[role], INVITE_TTL_DAYS))
  if (!sent) throw new ApiError(503, 'mail_failed', 'We could not send the invitation. Please try again.')
  return { ok: true as const }
}

async function activeSuperAdmins(q: { query: (sql: string, p?: unknown[]) => Promise<{ rows: { n: number }[] }> }, except?: string): Promise<number> {
  return (await q.query(`select count(*)::int as n from staff where role = 'super_admin' and active and ($1::uuid is null or user_id <> $1::uuid)`, [except ?? null])).rows[0].n
}

export async function changeRole(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such staff member.')
  const role = parseRole(body.role)
  if (id === ctx.userId) throw new ApiError(400, 'invalid_request', 'You cannot change your own role.')
  const db = await getDb()
  await db.tx(async (q) => {
    const cur = (await q.query<{ role: StaffRole }>('select role from staff where user_id = $1 for update', [id])).rows[0]
    if (!cur) throw new ApiError(404, 'not_found', 'No such staff member.')
    if (cur.role === 'super_admin' && role !== 'super_admin' && (await activeSuperAdmins(q, id)) < 1) throw new ApiError(409, 'last_super_admin', 'ChoiceMi needs at least one active super admin.')
    await q.query('update staff set role = $2, updated_at = now() where user_id = $1', [id, role])
    await audit(q, ctx, req, 'staff.role_changed', { type: 'user', id }, { from: cur.role, to: role })
  })
  return { ok: true as const }
}

/** Switching someone off ends their sessions at once. */
export async function setActive(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such staff member.')
  if (typeof body.active !== 'boolean') throw new ApiError(400, 'invalid_request', 'Say whether the account is active.')
  if (id === ctx.userId) throw new ApiError(400, 'invalid_request', 'You cannot switch yourself off.')
  const db = await getDb()
  await db.tx(async (q) => {
    const cur = (await q.query<{ role: StaffRole }>('select role from staff where user_id = $1 for update', [id])).rows[0]
    if (!cur) throw new ApiError(404, 'not_found', 'No such staff member.')
    if (!body.active && cur.role === 'super_admin' && (await activeSuperAdmins(q, id)) < 1) throw new ApiError(409, 'last_super_admin', 'ChoiceMi needs at least one active super admin.')
    await q.query('update staff set active = $2, updated_at = now() where user_id = $1', [id, body.active])
    if (!body.active) await q.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
    await audit(q, ctx, req, body.active ? 'staff.activated' : 'staff.deactivated', { type: 'user', id })
  })
  return { ok: true as const }
}

/** Who tickets can be assigned to: every active member of staff. Any staff role may ask. */
export async function directory() {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; username: string; role: StaffRole }>(`select u.id, u.username, s.role from staff s join users u on u.id = s.user_id where s.active order by u.username`)
  return { staff: rows.map((r) => ({ id: r.id, username: r.username, role: r.role, roleLabel: ROLE_LABEL[r.role] })) }
}
