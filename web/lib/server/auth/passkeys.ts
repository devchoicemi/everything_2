import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { getDb, type Queryable } from '../db'
import { appBaseUrl } from './config'
import { ApiError, clientIp } from './http'
import { logEvent } from './events'
import { rateLimit } from './rateLimit'
import { isTestAccount } from './otp'
import type { PublicUser } from './service'

/**
 * Passkeys (WebAuthn): sign in with a fingerprint, face or screen lock instead of a password and
 * a code. The device keeps the private key; we keep only the public key.
 *
 * - Adding one needs a signed-in member whose email is confirmed.
 * - Signing in with one is already two factors (the device, and the fingerprint or lock), so it
 *   skips the emailed code. We ask the device to verify the person (userVerification: required).
 * - Test accounts never use them.
 */
const RP_NAME = 'ChoiceMi'
const CHALLENGE_MINUTES = 5
export const MAX_PASSKEYS = 10

export interface PasskeyInfo {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  backedUp: boolean
}

/** The site identity a passkey is tied to. It must match the address in the browser. */
export function relyingParty(req: Request): { rpID: string; origin: string } {
  const base = appBaseUrl()
  if (base) {
    const u = new URL(base)
    return { rpID: u.hostname, origin: u.origin }
  }
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  return { rpID: new URL(origin).hostname, origin }
}

const b64u = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const fromB64u = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'))

function assertAllowed(user: PublicUser) {
  if (isTestAccount(user.role)) throw new ApiError(403, 'not_available', 'Passkeys are not used on test accounts.')
  if (!user.emailVerified) throw new ApiError(403, 'email_unverified', 'Confirm your email first.')
}

async function saveChallenge(q: Queryable, userId: string | null, purpose: 'register' | 'login', challenge: string): Promise<string> {
  await q.query(`delete from webauthn_challenges where expires_at < now() - interval '1 hour'`)
  const { rows } = await q.query<{ id: string }>(
    `insert into webauthn_challenges (user_id, purpose, challenge, expires_at)
     values ($1, $2, $3, now() + ($4 || ' minutes')::interval) returning id`,
    [userId, purpose, challenge, String(CHALLENGE_MINUTES)],
  )
  return rows[0].id
}

/** Takes a challenge exactly once; null if unknown, used or expired. */
async function takeChallenge(q: Queryable, where: { id?: string; userId?: string }, purpose: 'register' | 'login'): Promise<string | null> {
  const { rows } = await q.query<{ challenge: string }>(
    where.id
      ? `update webauthn_challenges set used_at = now() where id = $1 and purpose = $2 and used_at is null and expires_at > now() returning challenge`
      : `update webauthn_challenges set used_at = now()
          where id = (select id from webauthn_challenges where user_id = $1 and purpose = $2 and used_at is null and expires_at > now() order by expires_at desc limit 1)
          returning challenge`,
    [where.id ?? where.userId, purpose],
  )
  return rows[0]?.challenge ?? null
}

/* ------------------------------ adding a passkey ------------------------------ */

export async function registrationOptions(req: Request, user: PublicUser) {
  assertAllowed(user)
  await rateLimit('passkey-register', user.id, 20, 3600)
  const db = await getDb()
  const existing = await db.query<{ credential_id: string; transports: AuthenticatorTransportFuture[] | null }>(
    'select credential_id, transports from passkeys where user_id = $1',
    [user.id],
  )
  if (existing.rows.length >= MAX_PASSKEYS) throw new ApiError(400, 'too_many', `You can keep up to ${MAX_PASSKEYS} passkeys. Remove one first.`)
  const { rpID } = relyingParty(req)
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.username,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: existing.rows.map((r) => ({ id: r.credential_id, transports: r.transports ?? undefined })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  })
  await saveChallenge(db, user.id, 'register', options.challenge)
  return options
}

export async function verifyRegistration(req: Request, user: PublicUser, body: Record<string, unknown>): Promise<PasskeyInfo> {
  assertAllowed(user)
  await rateLimit('passkey-register', user.id, 20, 3600)
  const response = body.response as RegistrationResponseJSON | undefined
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
    throw new ApiError(400, 'invalid_request', 'Send the passkey response.')
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : 'My passkey'
  const db = await getDb()
  const expectedChallenge = await takeChallenge(db, { userId: user.id }, 'register')
  if (!expectedChallenge) throw new ApiError(400, 'challenge_expired', 'That took too long. Start again.')
  const { rpID, origin } = relyingParty(req)

  let verified
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch {
    throw new ApiError(400, 'passkey_rejected', 'We could not verify that passkey. Please try again.')
  }
  if (!verified.verified || !verified.registrationInfo) throw new ApiError(400, 'passkey_rejected', 'We could not verify that passkey. Please try again.')

  const { credential, credentialDeviceType, credentialBackedUp } = verified.registrationInfo
  try {
    const { rows } = await db.query<{ id: string; created_at: Date }>(
      `insert into passkeys (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) returning id, created_at`,
      [user.id, credential.id, b64u(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? response.response.transports ?? []), credentialDeviceType, credentialBackedUp, name],
    )
    await logEvent(db, 'passkey_added', req, user.id)
    return { id: rows[0].id, name, createdAt: rows[0].created_at.toISOString(), lastUsedAt: null, backedUp: credentialBackedUp }
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'already_added', 'This passkey is already added.')
    throw e
  }
}

export async function listPasskeys(userId: string): Promise<PasskeyInfo[]> {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; name: string; created_at: Date; last_used_at: Date | null; backed_up: boolean }>(
    'select id, name, created_at, last_used_at, backed_up from passkeys where user_id = $1 order by created_at',
    [userId],
  )
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at.toISOString(), lastUsedAt: r.last_used_at?.toISOString() ?? null, backedUp: r.backed_up }))
}

export async function removePasskey(req: Request, userId: string, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'not_found', 'No such passkey.')
  const db = await getDb()
  const { rows } = await db.query('delete from passkeys where id = $1 and user_id = $2 returning id', [id, userId])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such passkey.')
  await logEvent(db, 'passkey_removed', req, userId)
}

/* ----------------------------- signing in with one ---------------------------- */

export async function loginOptions(req: Request) {
  await rateLimit('passkey-login-ip', clientIp(req), 60, 900)
  const { rpID } = relyingParty(req)
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' })
  const db = await getDb()
  const challengeId = await saveChallenge(db, null, 'login', options.challenge)
  return { options, challengeId }
}

/** Checks the device's signed answer and returns the account to sign in. */
export async function verifyLogin(req: Request, body: Record<string, unknown>): Promise<string> {
  await rateLimit('passkey-login-ip', clientIp(req), 60, 900)
  const response = body.response as AuthenticationResponseJSON | undefined
  const challengeId = body.challengeId
  const fail = () => new ApiError(401, 'passkey_failed', 'That passkey did not work. Try again, or sign in with your password.')
  if (!response || typeof response !== 'object' || typeof response.id !== 'string' || typeof challengeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(challengeId)) throw fail()

  const db = await getDb()
  const expectedChallenge = await takeChallenge(db, { id: challengeId }, 'login')
  if (!expectedChallenge) throw fail()
  const row = (
    await db.query<{ id: string; user_id: string; public_key: string; counter: string; transports: AuthenticatorTransportFuture[] | null; role: string; status: string }>(
      `select p.id, p.user_id, p.public_key, p.counter, p.transports, u.role, u.status
         from passkeys p join users u on u.id = p.user_id where p.credential_id = $1`,
      [response.id],
    )
  ).rows[0]
  if (!row || row.status !== 'active' || isTestAccount(row.role)) throw fail()

  const { rpID, origin } = relyingParty(req)
  let verified
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: response.id, publicKey: fromB64u(row.public_key), counter: Number(row.counter), transports: row.transports ?? undefined },
    })
  } catch {
    throw fail()
  }
  if (!verified.verified) throw fail()
  await db.query('update passkeys set counter = $2, last_used_at = now() where id = $1', [row.id, verified.authenticationInfo.newCounter])
  return row.user_id
}

/* --------------------- the optional "add a passkey" suggestion --------------------- */

/** After "Not now", the suggestion stays away this many days. */
export const PROMPT_SNOOZE_DAYS = 7

/**
 * Whether to suggest a passkey right now. A passkey is an extra, optional layer, so it is only
 * suggested to members who can use one (confirmed email, not a test account), have none yet, and
 * have not said "not now" recently.
 */
export async function shouldSuggestPasskey(user: PublicUser): Promise<boolean> {
  if (isTestAccount(user.role) || !user.emailVerified) return false
  const db = await getDb()
  const { rows } = await db.query<{ n: number; snoozed: boolean }>(
    `select (select count(*)::int from passkeys where user_id = $1) as n,
            coalesce((select passkey_prompt_snoozed_until > now() from users where id = $1), false) as snoozed`,
    [user.id],
  )
  return rows[0].n === 0 && !rows[0].snoozed
}

export async function snoozePasskeyPrompt(req: Request, userId: string): Promise<void> {
  const db = await getDb()
  await db.query(`update users set passkey_prompt_snoozed_until = now() + ($2 || ' days')::interval where id = $1`, [userId, String(PROMPT_SNOOZE_DAYS)])
  await logEvent(db, 'passkey_prompt_skipped', req, userId)
}
