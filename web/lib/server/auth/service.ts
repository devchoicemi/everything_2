import { getDb, type Queryable } from '../db'
import { SESSION_DAYS, TERMS_VERSION, appLaunched, requirements, signupMode } from './config'
import { burnPasswordCheck, hashPassword, randomToken, sha256, verifyPassword } from './crypto'
import { ApiError, clientIp, clearSessionCookie, readCookie, sessionCookie, userAgent } from './http'
import { logEvent } from './events'
import { consumeInvite } from './waitlist'
import { uniqueUsername } from './username'
import { COOKIE_NAME, adminBaseUrl, partnerBaseUrl } from './config'
import { createDraftVenue } from '../partner/draft'
import { rateLimit } from './rateLimit'
import { loginCodeMail, resetPasswordMail, sendMail, verifyEmailMail } from './mailer'
import { checkCode, isTestAccount, issueCode, loginOtpEnabled, maskEmail, reissueLoginCode } from './otp'
import { checkNewPassword, normalizeEmail, requireString } from './validate'

/* --------------------------------- types --------------------------------- */

interface UserRow {
  id: string
  email: string
  password_hash: string
  role: 'member' | 'partner' | 'admin' | 'tester'
  username: string
  status: 'active' | 'suspended'
  email_verified_at: Date | null
  identity_verified_at: Date | null
  created_at: Date
  /** from member_profiles; set when the member finishes setup */
  onboarded_at?: Date | null
}

export interface PublicUser {
  id: string
  email: string
  /** the anonymous handle other members see */
  username: string
  role: UserRow['role']
  emailVerified: boolean
  identityVerified: boolean
  /** has finished profile setup; decides where sign-in sends them */
  onboarded: boolean
  createdAt: string
}

export type NextStep = 'verify_email' | 'verify_identity' | 'prelaunch' | 'continue'

export interface SessionInfo {
  authenticated: true
  user: PublicUser
  requirements: ReturnType<typeof requirements>
  next: NextStep
}

export interface AuthContext {
  sessionId: string
  user: PublicUser
}

const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  username: u.username,
  role: u.role,
  emailVerified: Boolean(u.email_verified_at),
  identityVerified: Boolean(u.identity_verified_at),
  onboarded: Boolean(u.onboarded_at),
  createdAt: u.created_at.toISOString(),
})

export function describeSession(user: PublicUser): SessionInfo {
  const req = requirements()
  const next: NextStep =
    // a restaurant's portal needs a confirmed email even where members do not, because booking alerts go there
    (req.emailVerification || user.role === 'partner') && !user.emailVerified && !isTestAccount(user.role)
      ? 'verify_email'
      : req.identity && !user.identityVerified && user.role !== 'partner' && user.role !== 'admin'
        ? 'verify_identity'
        : !appLaunched() && user.role !== 'admin' && user.role !== 'tester' && user.role !== 'partner'
          ? 'prelaunch'
          : 'continue'
  return { authenticated: true, user, requirements: req, next }
}

export { logEvent }

/* -------------------------------- sessions ------------------------------- */

async function createSession(q: Queryable, req: Request, userId: string): Promise<string> {
  const token = randomToken(32)
  await q.query(
    `insert into sessions (user_id, token_hash, expires_at, user_agent, ip)
     values ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [userId, sha256(token), String(SESSION_DAYS), userAgent(req), clientIp(req)],
  )
  return token
}

/** Returns the signed-in user for this request, or null. */
export async function getAuth(req: Request): Promise<AuthContext | null> {
  const token = readCookie(req, COOKIE_NAME)
  if (!token) return null
  const db = await getDb()
  const { rows } = await db.query<UserRow & { session_id: string; last_seen_at: Date }>(
    `select u.*, mp.onboarded_at, s.id as session_id, s.last_seen_at
       from sessions s join users u on u.id = s.user_id
       left join member_profiles mp on mp.user_id = u.id
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.status = 'active'`,
    [sha256(token)],
  )
  const row = rows[0]
  if (!row) return null
  if (Date.now() - row.last_seen_at.getTime() > 60 * 60 * 1000) {
    await db.query('update sessions set last_seen_at = now() where id = $1', [row.session_id])
  }
  return { sessionId: row.session_id, user: toPublic(row) }
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const auth = await getAuth(req)
  if (!auth) throw new ApiError(401, 'unauthenticated', 'Please sign in.')
  return auth
}

/* --------------------------------- sign up -------------------------------- */

export async function signUp(req: Request, body: Record<string, unknown>): Promise<{ user: PublicUser; cookie: string }> {
  const ip = clientIp(req)
  await rateLimit('signup-ip', ip, 10, 3600)

  const inviteToken = typeof body.inviteToken === 'string' && body.inviteToken ? body.inviteToken.slice(0, 200) : null
  // a restaurant starting its application: no invitation needed, and it gets a draft venue to fill in
  const applyAsPartner = body.applyAsPartner === true && !inviteToken
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : ''
  if (applyAsPartner && (contactName.length < 2 || contactName.length > 100)) {
    throw new ApiError(400, 'invalid_request', 'Enter your name.', { contactName: 'Check this.' })
  }
  if (!inviteToken && !applyAsPartner && signupMode() === 'invite') {
    throw new ApiError(403, 'invite_required', 'ChoiceMi is invitation-only for now. Join the waitlist and we will email you when it is your turn.')
  }

  const email = normalizeEmail(body.email)
  const password = checkNewPassword(body.password, email)
  if (body.acceptTerms !== true) {
    throw new ApiError(400, 'terms_required', 'Please accept the Terms and Privacy Policy.', { acceptTerms: 'Required.' })
  }
  if (body.over18 !== true && !applyAsPartner) {
    throw new ApiError(400, 'over18_required', 'You must be 18 or older to use ChoiceMi.', { over18: 'Required.' })
  }

  const db = await getDb()
  let invitedAsPartner = applyAsPartner
  let invitedAsStaff = false
  if (inviteToken) {
    // Fail fast, before the (deliberately slow) password hash, if the invitation is no good.
    const ok = await db.query<{ role: string }>('select role from invites where token_hash = $1 and email = $2 and used_at is null and expires_at > now()', [sha256(inviteToken), email])
    if (!ok.rows.length) throw new ApiError(403, 'invite_invalid', 'This invitation is not valid for that email, or it has expired.')
    invitedAsPartner = ok.rows[0].role === 'partner'
    invitedAsStaff = ok.rows[0].role === 'staff'
  }
  const taken = await db.query('select 1 from users where email = $1', [email])
  if (taken.rows.length) {
    await burnPasswordCheck(password)
    throw new ApiError(409, 'email_taken', 'An account with this email may already exist. Try signing in, or reset your password.')
  }

  const hash = await hashPassword(password)
  const verifyToken = randomToken(32)
  // Where email confirmation is required, even someone who followed an invitation confirms with a code.
  // Where it is not (no email provider yet), following the invitation is proof enough, as before.
  const confirmByCode = !inviteToken || requirements().emailVerification
  let code = ''
  let user: UserRow
  let sessionToken: string
  try {
    ;({ user, sessionToken } = await db.tx(async (q) => {
      const { rows } = await q.query<UserRow>(
        `insert into users (email, username, password_hash, terms_version, terms_accepted_at, over18_declared_at, email_verified_at)
         values ($1, $2, $3, $4, now(), now(), case when $5::boolean then now() end) returning *`,
        [email, await uniqueUsername(q), hash, TERMS_VERSION, !confirmByCode],
      )
      if (inviteToken) {
        const invite = await consumeInvite(q, inviteToken, email)
        await q.query('update invites set user_id = $2 where id = $1', [invite.id, rows[0].id])
        await q.query(`update waitlist set status = 'joined', joined_at = now() where email = $1`, [email])
        if (invite.role === 'staff' && invite.staffRole) {
          // ChoiceMi's own staff: the account becomes an admin account with the role they were invited to
          await q.query('insert into staff (user_id, role) values ($1, $2)', [rows[0].id, invite.staffRole])
          rows[0] = (await q.query<UserRow>(`update users set role = 'admin' where id = $1 returning *`, [rows[0].id])).rows[0]
        }
        if (invite.role === 'partner' && invite.venueId) {
          // a venue partner: tied to their venue; the first person from a venue is its owner
          const owners = await q.query('select 1 from venue_staff where venue_id = $1', [invite.venueId])
          await q.query('insert into venue_staff (user_id, venue_id, role) values ($1, $2, $3)', [rows[0].id, invite.venueId, owners.rows.length ? 'staff' : 'owner'])
          rows[0] = (await q.query<UserRow>(`update users set role = 'partner' where id = $1 returning *`, [rows[0].id])).rows[0]
        }
      }
      if (applyAsPartner) {
        await createDraftVenue(q, rows[0].id, contactName, email)
        rows[0] = (await q.query<UserRow>('select * from users where id = $1', [rows[0].id])).rows[0]
      }
      if (confirmByCode) {
        await q.query(
          `insert into email_tokens (user_id, purpose, token_hash, expires_at)
           values ($1, 'verify_email', $2, now() + interval '24 hours')`,
          [rows[0].id, sha256(verifyToken)],
        )
        code = (await issueCode(q, rows[0].id, 'verify_email')).code
      }
      const token = await createSession(q, req, rows[0].id)
      await logEvent(q, 'signup', req, rows[0].id, inviteToken ? { invited: true } : undefined)
      return { user: rows[0], sessionToken: token }
    }))
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      throw new ApiError(409, 'email_taken', 'An account with this email may already exist. Try signing in, or reset your password.')
    }
    throw e
  }

  if (confirmByCode) {
    await sendMail(verifyEmailMail(email, verifyToken, code, invitedAsStaff ? adminBaseUrl() : invitedAsPartner ? partnerBaseUrl() : undefined)).catch((e) => console.error('[auth] verification mail failed', e))
  }
  return { user: toPublic(user), cookie: sessionCookie(sessionToken) }
}

/* ---------------------------------- login --------------------------------- */

export type LoginResult =
  | { kind: 'session'; user: PublicUser; cookie: string }
  | { kind: 'otp'; challenge: string; emailHint: string }

export async function logIn(req: Request, body: Record<string, unknown>): Promise<LoginResult> {
  const ip = clientIp(req)
  const email = normalizeEmail(body.email)
  const password = requireString(body.password, 'password', 256)

  await rateLimit('login-ip', ip, 30, 900)
  await rateLimit('login-email', email, 20, 900)
  await rateLimit('login-pair', `${ip}|${email}`, 5, 900)

  const db = await getDb()
  const { rows } = await db.query<UserRow>(
    'select u.*, mp.onboarded_at from users u left join member_profiles mp on mp.user_id = u.id where u.email = $1',
    [email],
  )
  const user = rows[0]
  const ok = user ? await verifyPassword(password, user.password_hash) : (await burnPasswordCheck(password), false)

  if (!ok || !user) {
    await logEvent(db, 'login_failed', req, user?.id ?? null)
    throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password.')
  }
  if (user.status !== 'active') {
    await logEvent(db, 'login_blocked', req, user.id)
    throw new ApiError(403, 'account_suspended', 'This account is suspended. Contact admin@choicemi.com.')
  }

  // Password right. If a code is needed, nothing is signed in yet: the browser gets a challenge and
  // the code goes to the inbox. People who have not confirmed their email yet are let in to do that.
  if (loginOtpEnabled() && !isTestAccount(user.role) && user.email_verified_at) {
    const { code, challenge } = await db.tx((q) => issueCode(q, user.id, 'login'))
    const sent = await sendMail(loginCodeMail(user.email, code))
    if (!sent) {
      throw new ApiError(503, 'otp_unavailable', 'We could not send your sign-in code. Please try again in a minute.')
    }
    await logEvent(db, 'login_code_sent', req, user.id)
    return { kind: 'otp', challenge: challenge!, emailHint: maskEmail(user.email) }
  }

  return { kind: 'session', ...(await openSession(req, user)) }
}

/** Starts a signed-in session for a user whose identity has been proven (password and code, or passkey). */
async function openSession(req: Request, user: UserRow, via?: string): Promise<{ user: PublicUser; cookie: string }> {
  const db = await getDb()
  const token = await db.tx(async (q) => {
    await q.query('update users set last_login_at = now() where id = $1', [user.id])
    const t = await createSession(q, req, user.id)
    await logEvent(q, 'login', req, user.id, via ? { via } : undefined)
    return t
  })
  return { user: toPublic(user), cookie: sessionCookie(token) }
}

async function loadUser(userId: string): Promise<UserRow> {
  const db = await getDb()
  const { rows } = await db.query<UserRow>(
    'select u.*, mp.onboarded_at from users u left join member_profiles mp on mp.user_id = u.id where u.id = $1',
    [userId],
  )
  const user = rows[0]
  if (!user || user.status !== 'active') throw new ApiError(403, 'account_suspended', 'This account is suspended. Contact admin@choicemi.com.')
  return user
}

/** Second step of signing in: the emailed code that answers the challenge from the password step. */
export async function completeLogin(req: Request, body: Record<string, unknown>): Promise<{ user: PublicUser; cookie: string }> {
  await rateLimit('login-code-ip', clientIp(req), 30, 900)
  const challenge = requireString(body.challenge, 'challenge', 200)
  const db = await getDb()
  const userId = await checkCode(db, 'login', { challenge, code: body.code })
  return openSession(req, await loadUser(userId), 'password+code')
}

/** "Send the code again" during sign-in. Always answers the same, so it reveals nothing about the account. */
export async function resendLoginCode(req: Request, body: Record<string, unknown>): Promise<void> {
  await rateLimit('login-code-resend-ip', clientIp(req), 20, 900)
  const challenge = requireString(body.challenge, 'challenge', 200)
  const db = await getDb()
  const fresh = await reissueLoginCode(db, challenge)
  if (!fresh) return
  const { rows } = await db.query<{ email: string }>('select email from users where id = $1', [fresh.userId])
  if (rows[0]) await sendMail(loginCodeMail(rows[0].email, fresh.code))
}

/** Signs a member in after a passkey proved who they are (a passkey is two factors, so no code). */
export async function logInWithPasskey(req: Request, userId: string): Promise<{ user: PublicUser; cookie: string }> {
  return openSession(req, await loadUser(userId), 'passkey')
}

/* --------------------------------- logout --------------------------------- */

export async function logOut(req: Request, { all = false }: { all?: boolean } = {}): Promise<string> {
  const auth = await getAuth(req)
  if (auth) {
    const db = await getDb()
    if (all) await db.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [auth.user.id])
    else await db.query('update sessions set revoked_at = now() where id = $1', [auth.sessionId])
    await logEvent(db, all ? 'logout_all' : 'logout', req, auth.user.id)
  }
  return clearSessionCookie()
}

/* ------------------------------ email tokens ------------------------------ */

async function issueEmailToken(q: Queryable, userId: string, purpose: 'verify_email' | 'reset_password', ttl: string): Promise<string> {
  const token = randomToken(32)
  // Only the newest link works.
  await q.query(`update email_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null`, [userId, purpose])
  await q.query(
    `insert into email_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, now() + $4::interval)`,
    [userId, purpose, sha256(token), ttl],
  )
  return token
}

/** Marks a token used and returns its owner, or throws if it is unknown, used or expired. */
async function consumeEmailToken(q: Queryable, token: string, purpose: 'verify_email' | 'reset_password'): Promise<string> {
  const { rows } = await q.query<{ user_id: string }>(
    `update email_tokens set used_at = now()
      where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
      returning user_id`,
    [sha256(token), purpose],
  )
  if (!rows[0]) throw new ApiError(400, 'invalid_token', 'This link is invalid or has expired. Request a new one.')
  return rows[0].user_id
}

export async function verifyEmail(req: Request, body: Record<string, unknown>): Promise<void> {
  await rateLimit('verify-email-ip', clientIp(req), 30, 900)
  const db = await getDb()
  if (body.code !== undefined) {
    // the 6-digit code, typed by the signed-in person
    const auth = await requireAuth(req)
    await rateLimit('verify-email-code', auth.user.id, 20, 900)
    const userId = await checkCode(db, 'verify_email', { userId: auth.user.id, code: body.code })
    await db.tx((q) => markVerified(q, req, userId))
    return
  }
  // or the emailed link
  const token = requireString(body.token, 'token')
  await db.tx(async (q) => markVerified(q, req, await consumeEmailToken(q, token, 'verify_email')))
}

async function markVerified(q: Queryable, req: Request, userId: string): Promise<void> {
  await q.query('update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1', [userId])
  await logEvent(q, 'email_verified', req, userId)
}

export async function resendVerification(req: Request): Promise<void> {
  const auth = await requireAuth(req)
  if (auth.user.emailVerified) return
  await rateLimit('resend-verify', auth.user.id, 3, 3600)
  const db = await getDb()
  const token = await issueEmailToken(db, auth.user.id, 'verify_email', '24 hours')
  const { code } = await issueCode(db, auth.user.id, 'verify_email')
  await sendMail(verifyEmailMail(auth.user.email, token, code, auth.user.role === 'admin' ? adminBaseUrl() : auth.user.role === 'partner' ? partnerBaseUrl() : undefined))
}

/* ----------------------------- password reset ----------------------------- */

/** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
export async function forgotPassword(req: Request, body: Record<string, unknown>): Promise<void> {
  const email = normalizeEmail(body.email)
  await rateLimit('forgot-ip', clientIp(req), 10, 3600)
  await rateLimit('forgot-email', email, 3, 3600)
  const db = await getDb()
  const { rows } = await db.query<{ id: string; role: string }>("select id, role from users where email = $1 and status = 'active'", [email])
  if (!rows[0]) return
  const token = await issueEmailToken(db, rows[0].id, 'reset_password', '1 hour')
  await logEvent(db, 'password_reset_requested', req, rows[0].id)
  await sendMail(resetPasswordMail(email, token, rows[0].role === 'admin' ? adminBaseUrl() : rows[0].role === 'partner' ? partnerBaseUrl() : undefined))
}

export async function resetPassword(req: Request, body: Record<string, unknown>): Promise<void> {
  await rateLimit('reset-ip', clientIp(req), 20, 900)
  const token = requireString(body.token, 'token')
  const db = await getDb()
  await db.tx(async (q) => {
    const userId = await consumeEmailToken(q, token, 'reset_password')
    const { rows } = await q.query<{ email: string }>('select email from users where id = $1', [userId])
    const hash = await hashPassword(checkNewPassword(body.password, rows[0]?.email))
    await q.query(
      `update users set password_hash = $2, password_changed_at = now(), updated_at = now(),
              email_verified_at = coalesce(email_verified_at, now())
        where id = $1`,
      [userId, hash],
    )
    // A reset link proves control of the inbox, and ends every existing session.
    await q.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [userId])
    await logEvent(q, 'password_reset', req, userId)
  })
}

export async function changePassword(req: Request, body: Record<string, unknown>): Promise<void> {
  const auth = await requireAuth(req)
  await rateLimit('change-password', auth.user.id, 10, 900)
  const current = requireString(body.currentPassword, 'currentPassword', 256)
  const db = await getDb()
  const { rows } = await db.query<UserRow>('select * from users where id = $1', [auth.user.id])
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) {
    throw new ApiError(401, 'invalid_credentials', 'Your current password is incorrect.', { currentPassword: 'Incorrect.' })
  }
  const hash = await hashPassword(checkNewPassword(body.newPassword, auth.user.email))
  await db.tx(async (q) => {
    await q.query('update users set password_hash = $2, password_changed_at = now(), updated_at = now() where id = $1', [auth.user.id, hash])
    await q.query('update sessions set revoked_at = now() where user_id = $1 and id <> $2 and revoked_at is null', [auth.user.id, auth.sessionId])
    await logEvent(q, 'password_changed', req, auth.user.id)
  })
}

/* ----------------------------- account deletion ---------------------------- */

/** Right to erasure: removes the account and everything hanging off it (sessions, identities, tokens). */
export async function deleteAccount(req: Request, body: Record<string, unknown>): Promise<string> {
  const auth = await requireAuth(req)
  await rateLimit('delete-account', auth.user.id, 5, 900)
  const password = requireString(body.password, 'password', 256)
  const db = await getDb()
  const { rows } = await db.query<UserRow>('select * from users where id = $1', [auth.user.id])
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    throw new ApiError(401, 'invalid_credentials', 'Incorrect password.', { password: 'Incorrect.' })
  }
  await db.tx(async (q) => {
    await q.query('delete from users where id = $1', [auth.user.id])
    // The waitlist row and any invitations are keyed by email, so they are removed explicitly.
    await q.query('delete from waitlist where email = $1', [auth.user.email])
    await q.query('delete from invites where email = $1', [auth.user.email])
    // user_id is nulled by the FK; the event itself carries no personal data.
    await logEvent(q, 'account_deleted', req, null)
  })
  return clearSessionCookie()
}
