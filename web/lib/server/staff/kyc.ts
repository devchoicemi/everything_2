import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { audit, type StaffContext } from './access'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Identity checks (KYC). Members normally verify themselves through the bank-ID provider. This is for what a person
 * has to handle: people stuck without a verification, checks staff want to look at again, and manual decisions.
 * Every decision needs a note and is recorded in the audit log.
 */
export async function kycQueue(url: URL) {
  const view = url.searchParams.get('view') ?? 'cases'
  const db = await getDb()
  const counts = (
    await db.query<{ open: number; stuck: number; verified: number; unverified: number }>(
      `select (select count(*)::int from kyc_cases where status = 'open') as open,
              (select count(*)::int from users where role = 'member' and status = 'active' and identity_verified_at is null and created_at < now() - interval '24 hours') as stuck,
              (select count(*)::int from users where role = 'member' and identity_verified_at is not null) as verified,
              (select count(*)::int from users where role = 'member' and identity_verified_at is null) as unverified`,
    )
  ).rows[0]
  if (view === 'stuck') {
    const { rows } = await db.query(
      `select u.id, u.username, u.email, u.created_at, u.email_verified_at is not null as email_verified from users u
        where u.role = 'member' and u.status = 'active' and u.identity_verified_at is null and u.created_at < now() - interval '24 hours'
          and not exists (select 1 from kyc_cases c where c.user_id = u.id and c.status = 'open')
        order by u.created_at limit 100`,
    )
    return { counts, view, rows }
  }
  const status = url.searchParams.get('status')
  if (status && !['open', 'approved', 'rejected', 'revoked'].includes(status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')
  const { rows } = await db.query(
    `select c.id, c.status, c.reason, c.decision_note, c.created_at, c.decided_at, u.id as user_id, u.username, u.email, u.identity_verified_at is not null as verified
       from kyc_cases c join users u on u.id = c.user_id where ($1::text is null or c.status = $1) order by (c.status = 'open') desc, c.created_at desc limit 100`,
    [status],
  )
  return { counts, view: 'cases', rows }
}

export async function openCase(ctx: StaffContext, req: Request, body: Record<string, unknown>) {
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  if (!UUID.test(userId)) throw new ApiError(400, 'invalid_request', 'Send the user id.')
  if (!reason) throw new ApiError(400, 'reason_required', 'Say why this check needs a person.')
  const db = await getDb()
  return db.tx(async (q) => {
    if (!(await q.query(`select 1 from users where id = $1 and role in ('member', 'tester')`, [userId])).rows.length) throw new ApiError(404, 'not_found', 'No such member.')
    if ((await q.query(`select 1 from kyc_cases where user_id = $1 and status = 'open'`, [userId])).rows.length) throw new ApiError(409, 'already_open', 'There is already an open case for this member.')
    const row = (await q.query<{ id: string }>(`insert into kyc_cases (user_id, reason, opened_by) values ($1, $2, $3) returning id`, [userId, reason, ctx.userId])).rows[0]
    await audit(q, ctx, req, 'kyc.case_opened', { type: 'user', id: userId }, { reason })
    return { id: row.id }
  })
}

/**
 * approve: a person confirms the member's identity and that they are over 18 (recorded as a manual check).
 * reject: the check stays unverified, with the reason on record.
 * revoke: takes a verification away; the member has to verify again.
 */
export async function decide(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such case.')
  const decision = body.decision
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'revoke') throw new ApiError(400, 'invalid_request', 'Decision must be approve, reject or revoke.')
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  if (!note) throw new ApiError(400, 'note_required', 'Write a short note on what you checked.')
  if (decision === 'approve' && body.over18Confirmed !== true) throw new ApiError(400, 'over18_required', 'Confirm you have seen that the member is 18 or older.')
  const db = await getDb()
  await db.tx(async (q) => {
    const c = (await q.query<{ user_id: string; status: string }>('select user_id, status from kyc_cases where id = $1 for update', [id])).rows[0]
    if (!c) throw new ApiError(404, 'not_found', 'No such case.')
    if (c.status !== 'open') throw new ApiError(409, 'already_decided', 'This case has already been decided.')
    const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revoked'
    if (decision === 'approve') {
      await q.query(
        `insert into identities (user_id, provider, subject, idp, over18) values ($1, 'manual', $2, 'staff', true)
         on conflict (user_id, provider) do update set verified_at = now(), over18 = true`,
        [c.user_id, `manual:${c.user_id}`],
      )
      await q.query('update users set identity_verified_at = now(), updated_at = now() where id = $1', [c.user_id])
    }
    if (decision === 'revoke') {
      await q.query('delete from identities where user_id = $1', [c.user_id])
      await q.query('update users set identity_verified_at = null, updated_at = now() where id = $1', [c.user_id])
    }
    await q.query('update kyc_cases set status = $2, decided_by = $3, decision_note = $4, decided_at = now() where id = $1', [id, status, ctx.userId, note])
    await audit(q, ctx, req, `kyc.${status}`, { type: 'user', id: c.user_id }, { case: id })
  })
  return { ok: true as const }
}
