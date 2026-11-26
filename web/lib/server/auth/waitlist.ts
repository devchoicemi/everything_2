import { getDb, type Queryable } from '../db'
import { INVITE_TTL_DAYS } from './config'
import { randomToken, safeEqual, sha256 } from './crypto'
import { ApiError, clientIp } from './http'
import { unsubscribeToken, waitlistWelcomeMail, sendMail } from './mailer'
import { rateLimit } from './rateLimit'
import { logEvent } from './events'
import { normalizeEmail } from './validate'

export const WAITLIST_CONSENT_TEXT = 'Agreed to be emailed about the ChoiceMi launch and invitation (2026-10)'

/* -------------------------------- waitlist -------------------------------- */

/**
 * Adds an email to the waitlist. The answer is the same whether or not the
 * address was already there, so the form cannot be used to discover who signed up.
 */
export async function joinWaitlist(req: Request, body: Record<string, unknown>): Promise<void> {
  // Bots fill the hidden "company" field; pretend it worked and store nothing.
  if (typeof body.company === 'string' && body.company.trim()) return

  await rateLimit('waitlist-ip', clientIp(req), 8, 3600)
  const email = normalizeEmail(body.email)
  if (body.consent !== true) {
    throw new ApiError(400, 'consent_required', 'Please tick the box so we can email you about the launch.', { consent: 'Required.' })
  }
  await rateLimit('waitlist-email', email, 3, 3600)

  const source = typeof body.source === 'string' ? body.source.slice(0, 40) : null
  const db = await getDb()
  const { rows } = await db.query<{ id: string }>(
    `insert into waitlist (email, consent_text, source) values ($1, $2, $3)
     on conflict (email) do nothing returning id`,
    [email, WAITLIST_CONSENT_TEXT, source],
  )
  if (rows[0]) await sendMail(waitlistWelcomeMail(email))
}

/** Removes the person entirely (right to erasure) when they follow the signed link in an email. */
export async function unsubscribeWaitlist(req: Request, body: Record<string, unknown>): Promise<void> {
  await rateLimit('unsub-ip', clientIp(req), 20, 900)
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token : ''
  if (!safeEqual(token, unsubscribeToken(email))) {
    throw new ApiError(400, 'invalid_link', 'This link is not valid. Use the link from the email.')
  }
  const db = await getDb()
  await db.tx(async (q) => {
    await q.query('delete from waitlist where email = $1', [email])
    await q.query('delete from invites where email = $1 and used_at is null', [email])
    await logEvent(q, 'waitlist_unsubscribed', req, null)
  })
}

/* --------------------------------- invites -------------------------------- */

/** Creates a one-time invitation for an email and returns the token to put in the link. */
export async function createInvite(q: Queryable, email: string, opts: { role?: 'member' | 'partner' | 'staff'; venueId?: string; staffRole?: string } = {}): Promise<string> {
  const token = randomToken(32)
  // Only the newest link works.
  await q.query(`update invites set expires_at = now() where email = $1 and used_at is null and expires_at > now()`, [email])
  await q.query(
    `insert into invites (email, token_hash, expires_at, role, venue_id, staff_role) values ($1, $2, now() + ($3 || ' days')::interval, $4, $5, $6)`,
    [email, sha256(token), String(INVITE_TTL_DAYS), opts.role ?? 'member', opts.venueId ?? null, opts.staffRole ?? null],
  )
  return token
}

/** Lets the signup page prefill the invited email. Says nothing about invalid tokens beyond "not valid". */
export async function checkInvite(req: Request, token: string | null): Promise<{ valid: boolean; email?: string; role?: 'member' | 'partner' | 'staff'; venueName?: string }> {
  await rateLimit('invite-check-ip', clientIp(req), 60, 900)
  if (!token || token.length > 200) return { valid: false }
  const db = await getDb()
  const { rows } = await db.query<{ email: string; role: 'member' | 'partner' | 'staff'; venue_name: string | null }>(
    `select i.email, i.role, v.name as venue_name from invites i left join venues v on v.id = i.venue_id
      where i.token_hash = $1 and i.used_at is null and i.expires_at > now()`,
    [sha256(token)],
  )
  return rows[0] ? { valid: true, email: rows[0].email, role: rows[0].role, venueName: rows[0].venue_name ?? undefined } : { valid: false }
}

/**
 * Spends an invitation for `email` inside the sign-up transaction.
 * Throws if the token is unknown, used, expired, or was issued to a different email.
 */
export async function consumeInvite(q: Queryable, token: string, email: string): Promise<{ id: string; role: 'member' | 'partner' | 'staff'; venueId: string | null; staffRole: string | null }> {
  const { rows } = await q.query<{ id: string; role: 'member' | 'partner' | 'staff'; venue_id: string | null; staff_role: string | null }>(
    `update invites set used_at = now()
      where token_hash = $1 and email = $2 and used_at is null and expires_at > now()
      returning id, role, venue_id, staff_role`,
    [sha256(token), email],
  )
  if (!rows[0]) throw new ApiError(403, 'invite_invalid', 'This invitation is not valid for that email, or it has expired.')
  return { id: rows[0].id, role: rows[0].role, venueId: rows[0].venue_id, staffRole: rows[0].staff_role }
}
