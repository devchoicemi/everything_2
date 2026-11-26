// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { outbox } from '@/lib/server/auth/mailer'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { POST as loginVerify } from '@/app/api/v1/auth/login/verify/route'
import { POST as loginResend } from '@/app/api/v1/auth/login/resend/route'
import { POST as verifyEmail } from '@/app/api/v1/auth/email/verify/route'
import { POST as resendEmail } from '@/app/api/v1/auth/email/resend/route'
import { GET as session } from '@/app/api/v1/auth/session/route'

const BASE = 'http://localhost:3000'
const PW = 'correct horse battery'
let n = 0
const j = async (r: Response) => r.json() as Promise<any>
const req = (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'x-forwarded-for': `10.70.0.${++n}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]
const lastCode = () => /\b(\d{6})\b/.exec(outbox.at(-1)!.text)![1]
const wrong = (code: string) => (code === '000000' ? '111111' : '000000')

async function newMember() {
  const email = `otp${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { body: { email, password: PW, acceptTerms: true, over18: true } }))
  return { email, cookie: cookieOf(res), res }
}

/** A member whose email is already confirmed. */
async function confirmedMember(role = 'member') {
  const m = await newMember()
  const db = await getDb()
  await db.query(`update users set email_verified_at = now(), role = $2 where email = $1`, [m.email, role])
  return m
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.REQUIRE_EMAIL_VERIFICATION = '1'
  process.env.AUTH_OTP = '1'
  delete process.env.REQUIRE_IDENTITY
  delete process.env.SIGNICAT_DOMAIN
  await getDb()
}, 60_000)
beforeEach(() => {
  outbox.length = 0
  process.env.AUTH_OTP = '1'
})
afterAll(async () => {
  delete process.env.AUTH_OTP
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  await resetDb()
})

describe('email code at sign-up', () => {
  it('emails a 6-digit code (and the link), and the code confirms the email', async () => {
    const m = await newMember()
    expect(m.res.status).toBe(201)
    expect((await j(m.res)).next).toBe('verify_email')
    const mail = outbox.at(-1)!
    expect(mail.to).toBe(m.email)
    expect(mail.text).toMatch(/\b\d{6}\b/)
    expect(mail.text).toMatch(/verify-email\?token=/)
    expect(mail.html).toMatch(/letter-spacing/) // the code is shown large
    expect(mail.subject).toMatch(/^\d{6} is your ChoiceMi code/)

    const done = await verifyEmail(req('/api/v1/auth/email/verify', { cookie: m.cookie, body: { code: lastCode() } }))
    expect(done.status).toBe(200)
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: m.cookie })))
    expect(s.user.emailVerified).toBe(true)
    expect(s.next).toBe('continue')
  })

  it('needs the signed-in person: a code alone, without their session, does nothing', async () => {
    const m = await newMember()
    const code = lastCode()
    expect((await verifyEmail(req('/api/v1/auth/email/verify', { body: { code } }))).status).toBe(401)
    const other = await newMember()
    // someone else's session cannot use this member's code
    expect((await verifyEmail(req('/api/v1/auth/email/verify', { cookie: other.cookie, body: { code } }))).status).toBe(400)
    expect((await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: m.cookie })))).user.emailVerified).toBe(false)
  })

  it('rejects wrong, malformed and reused codes; five wrong tries kill the code', async () => {
    const m = await newMember()
    const code = lastCode()
    const go = (c: unknown) => verifyEmail(req('/api/v1/auth/email/verify', { cookie: m.cookie, body: { code: c } }))
    for (const bad of ['', 'abcdef', '12345', '1234567', 123456, null]) expect((await go(bad)).status, String(bad)).toBe(400)
    for (let i = 0; i < 5; i++) expect((await go(wrong(code))).status).toBe(400)
    // the code is now dead, even with the right digits
    const r = await go(code)
    expect(r.status).toBe(400)
    expect((await j(r)).error.code).toBe('invalid_code')

    // a fresh code works, and spaces are forgiven
    expect((await resendEmail(req('/api/v1/auth/email/resend', { cookie: m.cookie, body: {} }))).status).toBe(200)
    const fresh = lastCode()
    expect((await go(`${fresh.slice(0, 3)} ${fresh.slice(3)}`)).status).toBe(200)
    // single use
    expect((await go(fresh)).status).toBe(400)
  })

  it('a newer code replaces the older one, and an expired code is refused', async () => {
    const m = await newMember()
    const first = lastCode()
    await resendEmail(req('/api/v1/auth/email/resend', { cookie: m.cookie, body: {} }))
    const second = lastCode()
    const go = (c: string) => verifyEmail(req('/api/v1/auth/email/verify', { cookie: m.cookie, body: { code: c } }))
    if (first !== second) expect((await go(first)).status).toBe(400)
    const db = await getDb()
    await db.query(`update otp_codes set expires_at = now() - interval '1 minute' where used_at is null and user_id = (select id from users where email = $1)`, [m.email])
    expect((await go(second)).status).toBe(400)
  })

  it('the emailed link still works as well', async () => {
    const m = await newMember()
    const token = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]
    expect((await verifyEmail(req('/api/v1/auth/email/verify', { body: { token } }))).status).toBe(200)
  })
})

describe('email code at sign-in', () => {
  it('a correct password starts a challenge and signs nobody in until the code is entered', async () => {
    const m = await confirmedMember()
    outbox.length = 0
    const step1 = await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } }))
    expect(step1.status).toBe(200)
    expect(step1.headers.get('set-cookie')).toBeNull() // no session yet
    const body = await j(step1)
    expect(body.otpRequired).toBe(true)
    expect(body.challenge).toMatch(/^[\w-]{40,}$/)
    expect(body.emailHint).toMatch(/^\w\w\*\*\*@example\.com$/)
    expect(body.user).toBeUndefined()
    expect(outbox.at(-1)?.subject).toMatch(/sign-in code/)

    const code = lastCode()
    const bad = await loginVerify(req('/api/v1/auth/login/verify', { body: { challenge: body.challenge, code: wrong(code) } }))
    expect(bad.status).toBe(400)
    expect(bad.headers.get('set-cookie')).toBeNull()

    const ok = await loginVerify(req('/api/v1/auth/login/verify', { body: { challenge: body.challenge, code } }))
    expect(ok.status).toBe(200)
    const cookie = cookieOf(ok)
    expect(cookie).toMatch(/^cm_auth=/)
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie })))
    expect(s.authenticated).toBe(true)
    expect(s.user.email).toBe(m.email)

    // the challenge is used up
    const again = await loginVerify(req('/api/v1/auth/login/verify', { body: { challenge: body.challenge, code } }))
    expect(again.status).toBe(400)
  })

  it('a wrong password never sends a code', async () => {
    const m = await confirmedMember()
    outbox.length = 0
    const r = await login(req('/api/v1/auth/login', { body: { email: m.email, password: 'definitely not it' } }))
    expect(r.status).toBe(401)
    expect(outbox).toHaveLength(0)
  })

  it('a code cannot be used with another challenge, a made-up one, or after five wrong tries', async () => {
    const a = await confirmedMember()
    const b = await confirmedMember()
    outbox.length = 0
    const ca = (await j(await login(req('/api/v1/auth/login', { body: { email: a.email, password: PW } })))).challenge
    const codeA = lastCode()
    const cb = (await j(await login(req('/api/v1/auth/login', { body: { email: b.email, password: PW } })))).challenge
    const codeB = lastCode()
    const go = (challenge: string, code: string) => loginVerify(req('/api/v1/auth/login/verify', { body: { challenge, code } }))
    expect((await go(cb, codeA)).status).toBe(400) // A's code on B's challenge
    expect((await go('x'.repeat(43), codeA)).status).toBe(400)
    expect((await go('', codeA)).status).toBe(400)
    // B's challenge just took one wrong try; four more and it is dead
    for (let i = 0; i < 4; i++) await go(cb, wrong(codeB))
    expect((await go(cb, codeB)).status).toBe(400)
    // A is unaffected
    expect((await go(ca, codeA)).status).toBe(200)
  })

  it('an expired code is refused, and "send again" gives a new one and retires the old', async () => {
    const m = await confirmedMember()
    outbox.length = 0
    const challenge = (await j(await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } })))).challenge
    const first = lastCode()
    outbox.length = 0
    expect((await loginResend(req('/api/v1/auth/login/resend', { body: { challenge } }))).status).toBe(200)
    expect(outbox).toHaveLength(1)
    const second = lastCode()
    const go = (c: string) => loginVerify(req('/api/v1/auth/login/verify', { body: { challenge, code: c } }))
    if (first !== second) expect((await go(first)).status).toBe(400)
    const db = await getDb()
    await db.query(`update otp_codes set expires_at = now() - interval '1 minute' where challenge_hash is not null and used_at is null and user_id = (select id from users where email = $1)`, [m.email])
    expect((await go(second)).status).toBe(400)
    // resending for an unknown challenge looks the same and sends nothing
    outbox.length = 0
    expect((await loginResend(req('/api/v1/auth/login/resend', { body: { challenge: 'y'.repeat(43) } }))).status).toBe(200)
    expect(outbox).toHaveLength(0)
  })

  it('limits how many codes can be requested for one challenge', async () => {
    const m = await confirmedMember()
    const challenge = (await j(await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } })))).challenge
    let last = 200
    for (let i = 0; i < 7; i++) last = (await loginResend(req('/api/v1/auth/login/resend', { body: { challenge } }))).status
    expect(last).toBe(429)
  })

  it('someone who has not confirmed their email signs in without a code, to be able to confirm it', async () => {
    const m = await newMember()
    outbox.length = 0
    const r = await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } }))
    expect((await j(r)).next).toBe('verify_email')
    expect(cookieOf(r)).toMatch(/^cm_auth=/)
  })

  it('suspended accounts cannot finish signing in', async () => {
    const m = await confirmedMember()
    outbox.length = 0
    const challenge = (await j(await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } })))).challenge
    const code = lastCode()
    const db = await getDb()
    await db.query(`update users set status = 'suspended' where email = $1`, [m.email])
    expect((await loginVerify(req('/api/v1/auth/login/verify', { body: { challenge, code } }))).status).toBe(403)
  })

  it('is switched off with AUTH_OTP=0, and when no email provider could deliver it', async () => {
    const m = await confirmedMember()
    process.env.AUTH_OTP = '0'
    const off = await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } }))
    expect(off.status).toBe(200)
    expect(cookieOf(off)).toMatch(/^cm_auth=/)
    // default (unset) with no mail provider configured: nothing could be delivered, so no code step
    delete process.env.AUTH_OTP
    const unset = await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } }))
    expect(cookieOf(unset)).toMatch(/^cm_auth=/)
  })
})

describe('test accounts are left alone', () => {
  it('a tester signs in with just the password, never sees a code step, and counts as confirmed', async () => {
    const t = await newMember() // unconfirmed on purpose: testers have made-up emails
    const db = await getDb()
    await db.query(`update users set role = 'tester' where email = $1`, [t.email])
    outbox.length = 0
    const r = await login(req('/api/v1/auth/login', { body: { email: t.email, password: PW } }))
    expect(r.status).toBe(200)
    const body = await j(r)
    expect(body.otpRequired).toBeUndefined()
    expect(body.next).not.toBe('verify_email')
    expect(outbox).toHaveLength(0)
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: cookieOf(r) })))
    expect(s.security).toMatchObject({ exempt: true, loginCode: false, passkeys: 0 })
  })

  it('ordinary members are told a code is used', async () => {
    const m = await confirmedMember()
    outbox.length = 0
    const challenge = (await j(await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } })))).challenge
    const ok = await loginVerify(req('/api/v1/auth/login/verify', { body: { challenge, code: lastCode() } }))
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: cookieOf(ok) })))
    expect(s.security).toMatchObject({ exempt: false, loginCode: true })
  })
})
