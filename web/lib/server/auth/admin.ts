import { getDb } from '../db'
import { adminToken, canSendMail } from './config'
import { safeEqual } from './crypto'
import { ApiError, clientIp } from './http'
import { inviteMail, sendMail } from './mailer'
import { rateLimit } from './rateLimit'
import { logEvent } from './events'
import { createInvite } from './waitlist'
import { INVITE_TTL_DAYS } from './config'
import { normalizeEmail } from './validate'
import { decryptField, vaultConfigured } from './vault'

/** Admin API guard: `Authorization: Bearer <ADMIN_TOKEN>`. Switched off while ADMIN_TOKEN is unset. */
export async function requireAdmin(req: Request): Promise<void> {
  const expected = adminToken()
  if (!expected) throw new ApiError(503, 'admin_disabled', 'The admin API is not switched on.')
  await rateLimit('admin-ip', clientIp(req), 60, 900)
  const header = req.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!given || !safeEqual(given, expected)) throw new ApiError(401, 'unauthorized', 'Not authorised.')
}

/* ------------------------------- waitlist list ------------------------------ */

export async function listWaitlist(url: URL) {
  const status = url.searchParams.get('status')
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  if (status && !['waiting', 'invited', 'joined'].includes(status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')

  const db = await getDb()
  const counts = await db.query<{ status: string; n: number }>('select status, count(*)::int as n from waitlist group by status')
  const rows = await db.query<{ email: string; status: string; created_at: Date; invited_at: Date | null; joined_at: Date | null; source: string | null }>(
    `select email, status, created_at, invited_at, joined_at, source from waitlist
      where ($1::text is null or status = $1) order by created_at asc limit $2 offset $3`,
    [status, limit, offset],
  )
  const byStatus = { waiting: 0, invited: 0, joined: 0 } as Record<string, number>
  for (const c of counts.rows) byStatus[c.status] = c.n
  return {
    counts: { ...byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) },
    entries: rows.rows.map((r) => ({
      email: r.email,
      status: r.status,
      source: r.source,
      joinedWaitlistAt: r.created_at.toISOString(),
      invitedAt: r.invited_at?.toISOString() ?? null,
      accountCreatedAt: r.joined_at?.toISOString() ?? null,
    })),
  }
}

/* --------------------------------- invitations --------------------------------- */

export interface InviteBatchResult {
  dryRun: boolean
  requested: number
  sent: number
  failed: number
  skipped: number
  remainingWaiting: number
  emails: string[]
}

/**
 * Emails invitations.
 * - `limit`: invite the oldest N people who are still waiting (default 25, max 200).
 * - `emails`: invite these specific people (must be on the waitlist unless `allowDirect` is true).
 * - `dryRun`: report who would be invited without sending or changing anything.
 * Each invitation is a one-time link; a failed send leaves the person waiting.
 */
export async function inviteBatch(req: Request, body: Record<string, unknown>): Promise<InviteBatchResult> {
  const dryRun = body.dryRun === true
  const allowDirect = body.allowDirect === true
  if (!dryRun && !canSendMail()) {
    throw new ApiError(409, 'mail_not_configured', 'Email is not configured yet (RESEND_API_KEY and MAIL_FROM), so no invitations were sent.')
  }

  const db = await getDb()
  let candidates: string[]
  let skipped = 0

  if (Array.isArray(body.emails) && body.emails.length) {
    if (body.emails.length > 200) throw new ApiError(400, 'invalid_request', 'At most 200 emails per call.')
    const wanted = [...new Set(body.emails.map(normalizeEmail))]
    const { rows: users } = await db.query<{ email: string }>('select email from users where email = any($1)', [wanted])
    const hasAccount = new Set(users.map((u) => u.email))
    const { rows: onList } = await db.query<{ email: string }>('select email from waitlist where email = any($1)', [wanted])
    const listed = new Set(onList.map((r) => r.email))
    candidates = wanted.filter((e) => !hasAccount.has(e) && (allowDirect || listed.has(e)))
    skipped = wanted.length - candidates.length
  } else {
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 200)
    const { rows } = await db.query<{ email: string }>(
      `select w.email from waitlist w
        where w.status = 'waiting' and not exists (select 1 from users u where u.email = w.email)
        order by w.created_at asc limit $1`,
      [limit],
    )
    candidates = rows.map((r) => r.email)
  }

  const waiting = async () => (await db.query<{ n: number }>("select count(*)::int as n from waitlist where status = 'waiting'")).rows[0].n
  if (dryRun) {
    return { dryRun, requested: candidates.length, sent: 0, failed: 0, skipped, remainingWaiting: await waiting(), emails: candidates }
  }

  const sentTo: string[] = []
  let failed = 0
  for (const email of candidates) {
    // Create the invite first, then send; undo it if the email did not go out.
    const token = await db.tx(async (q) => {
      const t = await createInvite(q, email)
      await q.query(
        `insert into waitlist (email, status, consent_text, source, invited_at)
         values ($1, 'invited', 'Invited directly by an administrator', 'admin-direct', now())
         on conflict (email) do update set status = case when waitlist.status = 'joined' then 'joined' else 'invited' end, invited_at = now()`,
        [email],
      )
      return t
    })
    const ok = await sendMail(inviteMail(email, token, INVITE_TTL_DAYS))
    if (ok) {
      sentTo.push(email)
    } else {
      failed++
      await db.tx(async (q) => {
        await q.query('delete from invites where email = $1 and used_at is null', [email])
        await q.query(`update waitlist set status = 'waiting', invited_at = null where email = $1 and status = 'invited'`, [email])
      })
    }
  }
  await logEvent(db, 'admin_invites_sent', req, null, { sent: sentTo.length, failed })
  return { dryRun, requested: candidates.length, sent: sentTo.length, failed, skipped, remainingWaiting: await waiting(), emails: sentTo }
}

/**
 * Security lookup: the verified identity record for one member, including the decrypted legal name.
 * Every call is written to the security log with the caller's IP.
 */
export async function lookupIdentity(req: Request, url: URL) {
  const email = normalizeEmail(url.searchParams.get('email'))
  const db = await getDb()
  const { rows } = await db.query<{
    id: string
    created_at: Date
    provider: string | null
    idp: string | null
    over18: boolean | null
    verified_at: Date | null
    name_enc: string | null
  }>(
    `select u.id, u.created_at, i.provider, i.idp, i.over18, i.verified_at, i.name_enc
       from users u left join identities i on i.user_id = u.id where u.email = $1
       order by i.verified_at desc nulls last limit 1`,
    [email],
  )
  const r = rows[0]
  if (!r) throw new ApiError(404, 'not_found', 'No account with that email.')
  await logEvent(db, 'admin_identity_viewed', req, r.id)
  let name: string | null = null
  if (r.name_enc) {
    if (!vaultConfigured()) throw new ApiError(503, 'vault_unavailable', 'IDENTITY_DATA_KEY is not set, so the name cannot be read.')
    try {
      name = decryptField(r.name_enc)
    } catch {
      throw new ApiError(500, 'vault_error', 'The stored name could not be decrypted (wrong key?).')
    }
  }
  return {
    email,
    accountCreatedAt: r.created_at.toISOString(),
    verified: Boolean(r.verified_at),
    provider: r.provider,
    idp: r.idp,
    over18: r.over18,
    verifiedAt: r.verified_at ? r.verified_at.toISOString() : null,
    legalName: name,
  }
}
