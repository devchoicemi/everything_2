import { randomInt } from 'node:crypto'
import type { Queryable } from '../db'
import { ApiError } from './http'
import { randomToken, safeEqual, sha256 } from './crypto'
import { mailConfigured } from './config'

/**
 * Email one-time codes (6 digits), used to confirm an email at sign-up and as the second step of
 * signing in with a password.
 *
 * - Only a hash is stored. A code lives 10 minutes and gets 5 wrong tries, then it is dead.
 * - A sign-in code belongs to a challenge: a random token the browser holds. Without the password
 *   step there is no challenge, so a code alone is useless.
 * - Wrong tries are counted atomically before the code is compared, so parallel guesses cannot
 *   squeeze extra attempts in.
 * - Test accounts (role 'tester') have made-up email addresses that cannot receive mail, so they are
 *   never asked for a code.
 */
export const OTP_MINUTES = 10
export const OTP_MAX_TRIES = 5
export const OTP_MAX_RESENDS = 5

export type OtpPurpose = 'verify_email' | 'login'

/** Roles that never get a code or a passkey prompt: their emails are not real inboxes. */
export const isTestAccount = (role: string) => role === 'tester'

/**
 * Whether signing in with a password needs an emailed code. On by default once a real email
 * provider is set up (so a code can actually be delivered); AUTH_OTP=1 forces it on (development and
 * tests), AUTH_OTP=0 switches it off (an emergency way back in if mail is down).
 */
export function loginOtpEnabled(): boolean {
  if (process.env.AUTH_OTP === '0') return false
  if (process.env.AUTH_OTP === '1') return true
  return mailConfigured()
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

const hashCode = (userId: string, code: string) => sha256(`otp:${userId}:${code}`)
const clean = (code: unknown) => (typeof code === 'string' ? code.replace(/\s+/g, '') : '')

/** Starts a fresh code for a purpose, ending any earlier unused one. `challenge` is for sign-in codes. */
export async function issueCode(
  q: Queryable,
  userId: string,
  purpose: OtpPurpose,
  challenge?: string,
): Promise<{ code: string; challenge?: string }> {
  const code = newCode()
  const token = purpose === 'login' ? (challenge ?? randomToken(32)) : undefined
  await q.query(`update otp_codes set used_at = now() where user_id = $1 and purpose = $2 and used_at is null`, [userId, purpose])
  await q.query(
    `insert into otp_codes (user_id, purpose, challenge_hash, code_hash, expires_at)
     values ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [userId, purpose, token ? sha256(token) : null, hashCode(userId, code), String(OTP_MINUTES)],
  )
  return { code, challenge: token }
}

/** New code for an existing sign-in challenge (the "send it again" button). Limited per challenge. */
export async function reissueLoginCode(q: Queryable, challenge: string): Promise<{ code: string; userId: string } | null> {
  const row = (
    await q.query<{ id: string; user_id: string; resends: number }>(
      `select id, user_id, resends from otp_codes where challenge_hash = $1 and purpose = 'login' and used_at is null and expires_at > now() - interval '30 minutes'`,
      [sha256(challenge)],
    )
  ).rows[0]
  if (!row) return null
  if (row.resends >= OTP_MAX_RESENDS) throw new ApiError(429, 'rate_limited', 'Too many codes requested. Please wait and sign in again.')
  const code = newCode()
  await q.query(
    `update otp_codes set code_hash = $2, attempts = 0, resends = resends + 1, expires_at = now() + ($3 || ' minutes')::interval where id = $1`,
    [row.id, hashCode(row.user_id, code), String(OTP_MINUTES)],
  )
  return { code, userId: row.user_id }
}

const BAD = () => new ApiError(400, 'invalid_code', 'That code is not right, or it has expired. Check it and try again, or ask for a new one.')

/**
 * Checks a code. For sign-in, give the challenge token (the user is found from it); for email
 * confirmation, give the signed-in user's id. Returns the user id when the code is right.
 */
export async function checkCode(
  q: Queryable,
  purpose: OtpPurpose,
  input: { code: unknown; userId?: string; challenge?: string },
): Promise<string> {
  const code = clean(input.code)
  if (!/^\d{6}$/.test(code)) throw BAD()

  const where = purpose === 'login'
    ? { sql: 'challenge_hash = $1', arg: sha256(input.challenge ?? '') }
    : { sql: 'user_id = $1', arg: input.userId ?? '' }
  // The newest live code, and one more wrong try counted on it, in a single statement.
  const { rows } = await q.query<{ id: string; user_id: string; code_hash: string }>(
    `update otp_codes set attempts = attempts + 1
      where id = (
        select id from otp_codes
         where ${where.sql} and purpose = '${purpose}' and used_at is null and expires_at > now() and attempts < ${OTP_MAX_TRIES}
         order by created_at desc limit 1
      )
      returning id, user_id, code_hash`,
    [where.arg],
  )
  const row = rows[0]
  if (!row || !safeEqual(row.code_hash, hashCode(row.user_id, code))) throw BAD()
  // single use, even if two requests carry the right code at once
  const used = await q.query('update otp_codes set used_at = now() where id = $1 and used_at is null returning id', [row.id])
  if (!used.rows[0]) throw BAD()
  return row.user_id
}

/** "ab***@gmail.com": enough to recognise the inbox without revealing the address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, Math.min(2, name.length))}***@${domain}`
}
