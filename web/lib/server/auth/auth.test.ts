// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDb, getDb } from '@/lib/server/db'
import { outbox } from '@/lib/server/auth/mailer'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { POST as logout } from '@/app/api/v1/auth/logout/route'
import { POST as logoutAll } from '@/app/api/v1/auth/logout-all/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { POST as verifyEmail } from '@/app/api/v1/auth/email/verify/route'
import { POST as forgot } from '@/app/api/v1/auth/password/forgot/route'
import { POST as reset } from '@/app/api/v1/auth/password/reset/route'
import { POST as change } from '@/app/api/v1/auth/password/change/route'
import { DELETE as deleteMe } from '@/app/api/v1/me/route'
import { POST as startIdentity } from '@/app/api/v1/auth/signicat/start/route'
import { GET as identityCallback } from '@/app/api/v1/auth/signicat/callback/route'
import { GET as mockAuthorize } from '@/app/api/v1/auth/signicat/mock-authorize/route'

const BASE = 'http://localhost:3000'
let ipCounter = 0

function post(path: string, body: unknown, opts: { cookie?: string; ip?: string; origin?: string; method?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': opts.ip ?? `10.0.0.${++ipCounter}`,
  }
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.origin) headers.origin = opts.origin
  return new Request(`${BASE}${path}`, { method: opts.method ?? 'POST', headers, body: JSON.stringify(body) })
}
function get(path: string, cookie?: string) {
  return new Request(`${BASE}${path}`, { headers: cookie ? { cookie } : {} })
}
const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]
const j = async (res: Response) => res.json() as Promise<any>

const PW = 'correct horse battery'
let n = 0
const newEmail = () => `user${++n}-${Date.now()}@example.com`

async function register(email = newEmail(), password = PW) {
  const res = await signup(post('/api/v1/auth/signup', { email, password, acceptTerms: true, over18: true }))
  return { res, email, cookie: cookieOf(res) }
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNICAT_MOCK = '1'
  delete process.env.SIGNICAT_DOMAIN
  delete process.env.RESEND_API_KEY
  delete process.env.REQUIRE_IDENTITY
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  await getDb() // boot the in-process Postgres + run migrations once
}, 60_000)

beforeEach(() => {
  outbox.length = 0
})

describe('sign up', () => {
  it('creates an account, signs the user in and sends a confirmation email', async () => {
    const { res, email, cookie } = await register()
    expect(res.status).toBe(201)
    const body = await j(res)
    expect(body.user.email).toBe(email)
    expect(body.user.emailVerified).toBe(false)
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i)
    const setCookie = res.headers.get('set-cookie')!
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/^cm_auth=.{40,}/)
    expect(outbox.at(-1)?.to).toBe(email)
    expect(outbox.at(-1)?.text).toMatch(/verify-email\?token=/)
  })

  it('never stores the password or the session token in clear', async () => {
    const { email, cookie } = await register()
    const db = await getDb()
    const u = (await db.query<{ password_hash: string }>('select password_hash from users where email=$1', [email])).rows[0]
    expect(u.password_hash.startsWith('scrypt$')).toBe(true)
    expect(u.password_hash).not.toContain(PW)
    const token = decodeURIComponent(cookie.split('=')[1])
    const s = await db.query('select 1 from sessions where token_hash = $1', [token])
    expect(s.rows).toHaveLength(0)
  })

  it('normalises the email and rejects duplicates', async () => {
    const email = newEmail()
    await register(email.toUpperCase())
    const again = await register(`  ${email}  `)
    expect(again.res.status).toBe(409)
    expect((await j(again.res)).error.code).toBe('email_taken')
  })

  it.each([
    [{ email: 'nope', password: PW, acceptTerms: true, over18: true }, 'invalid_email'],
    [{ email: 'a@b.co', password: 'short', acceptTerms: true, over18: true }, 'weak_password'],
    [{ email: 'a@b.co', password: 'password123', acceptTerms: true, over18: true }, 'weak_password'],
    [{ email: 'a@b.co', password: PW, acceptTerms: false, over18: true }, 'terms_required'],
    [{ email: 'a@b.co', password: PW, acceptTerms: true, over18: false }, 'over18_required'],
  ])('rejects invalid input %#', async (body, code) => {
    const res = await signup(post('/api/v1/auth/signup', body))
    expect(res.status).toBe(400)
    expect((await j(res)).error.code).toBe(code)
  })

  it('rate limits sign-ups from one address', async () => {
    const ip = '203.0.113.9'
    let last = 0
    for (let i = 0; i < 12; i++) {
      const r = await signup(post('/api/v1/auth/signup', { email: newEmail(), password: PW, acceptTerms: true, over18: true }, { ip }))
      last = r.status
    }
    expect(last).toBe(429)
  })
})

describe('session', () => {
  it('reports signed out without a cookie', async () => {
    const body = await j(await session(get('/api/v1/auth/session')))
    expect(body.authenticated).toBe(false)
  })

  it('reports the signed-in user with a cookie, and rejects a forged one', async () => {
    const { email, cookie } = await register()
    const ok = await j(await session(get('/api/v1/auth/session', cookie)))
    expect(ok.authenticated).toBe(true)
    expect(ok.user.email).toBe(email)
    const bad = await j(await session(get('/api/v1/auth/session', 'cm_auth=forged-token')))
    expect(bad.authenticated).toBe(false)
  })
})

describe('login / logout', () => {
  it('logs in with the right password', async () => {
    const { email } = await register()
    const res = await login(post('/api/v1/auth/login', { email, password: PW }))
    expect(res.status).toBe(200)
    const cookie = cookieOf(res)
    expect((await j(await session(get('/api/v1/auth/session', cookie)))).authenticated).toBe(true)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await register()
    const wrong = await login(post('/api/v1/auth/login', { email, password: 'not the password' }))
    const unknown = await login(post('/api/v1/auth/login', { email: newEmail(), password: 'not the password' }))
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(await j(wrong)).toEqual(await j(unknown))
  })

  it('locks out repeated guesses for one account from one address', async () => {
    const { email } = await register()
    const ip = '198.51.100.7'
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      statuses.push((await login(post('/api/v1/auth/login', { email, password: `wrong-${i}` }, { ip }))).status)
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[6]).toBe(429)
    // the correct password is also refused while locked, from that address
    expect((await login(post('/api/v1/auth/login', { email, password: PW }, { ip }))).status).toBe(429)
  })

  it('logout ends only that session; logout-all ends every session', async () => {
    const { email, cookie: a } = await register()
    const b = cookieOf(await login(post('/api/v1/auth/login', { email, password: PW })))
    const out = await logout(post('/api/v1/auth/logout', {}, { cookie: a }))
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/)
    expect((await j(await session(get('/api/v1/auth/session', a)))).authenticated).toBe(false)
    expect((await j(await session(get('/api/v1/auth/session', b)))).authenticated).toBe(true)
    await logoutAll(post('/api/v1/auth/logout-all', {}, { cookie: b }))
    expect((await j(await session(get('/api/v1/auth/session', b)))).authenticated).toBe(false)
  })
})

describe('request safety', () => {
  it('refuses cross-site POSTs', async () => {
    const res = await signup(post('/api/v1/auth/signup', { email: newEmail(), password: PW, acceptTerms: true, over18: true }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
  })

  it('accepts same-origin POSTs', async () => {
    const res = await signup(post('/api/v1/auth/signup', { email: newEmail(), password: PW, acceptTerms: true, over18: true }, { origin: BASE }))
    expect(res.status).toBe(201)
  })

  it('requires JSON', async () => {
    const res = await login(new Request(`${BASE}/api/v1/auth/login`, { method: 'POST', body: 'email=a' }))
    expect(res.status).toBe(415)
  })
})

describe('email confirmation', () => {
  it('confirms with the emailed token once, and not again', async () => {
    const { cookie } = await register()
    const token = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]
    expect((await verifyEmail(post('/api/v1/auth/email/verify', { token }))).status).toBe(200)
    expect((await j(await session(get('/api/v1/auth/session', cookie)))).user.emailVerified).toBe(true)
    expect((await verifyEmail(post('/api/v1/auth/email/verify', { token }))).status).toBe(400)
  })

  it('rejects an unknown token', async () => {
    expect((await verifyEmail(post('/api/v1/auth/email/verify', { token: 'nope' }))).status).toBe(400)
  })
})

describe('password reset', () => {
  it('replies the same for unknown emails and sends nothing', async () => {
    const res = await forgot(post('/api/v1/auth/password/forgot', { email: newEmail() }))
    expect(res.status).toBe(200)
    expect(outbox).toHaveLength(0)
  })

  it('resets with the emailed token, ends old sessions and allows the new password', async () => {
    const { email, cookie } = await register()
    outbox.length = 0
    expect((await forgot(post('/api/v1/auth/password/forgot', { email }))).status).toBe(200)
    const token = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]

    const weak = await reset(post('/api/v1/auth/password/reset', { token, password: 'short' }))
    expect(weak.status).toBe(400) // token survives a rejected password

    const newPw = 'a brand new passphrase'
    expect((await reset(post('/api/v1/auth/password/reset', { token, password: newPw }))).status).toBe(200)
    expect((await reset(post('/api/v1/auth/password/reset', { token, password: newPw }))).status).toBe(400)
    expect((await j(await session(get('/api/v1/auth/session', cookie)))).authenticated).toBe(false)
    expect((await login(post('/api/v1/auth/login', { email, password: PW }))).status).toBe(401)
    expect((await login(post('/api/v1/auth/login', { email, password: newPw }))).status).toBe(200)
  })

  it('changes the password for a signed-in user and keeps only the current session', async () => {
    const { email, cookie } = await register()
    const other = cookieOf(await login(post('/api/v1/auth/login', { email, password: PW })))
    const bad = await change(post('/api/v1/auth/password/change', { currentPassword: 'wrong', newPassword: 'another long passphrase' }, { cookie }))
    expect(bad.status).toBe(401)
    const ok = await change(post('/api/v1/auth/password/change', { currentPassword: PW, newPassword: 'another long passphrase' }, { cookie }))
    expect(ok.status).toBe(200)
    expect((await j(await session(get('/api/v1/auth/session', cookie)))).authenticated).toBe(true)
    expect((await j(await session(get('/api/v1/auth/session', other)))).authenticated).toBe(false)
  })

  it('requires sign-in to change a password', async () => {
    const res = await change(post('/api/v1/auth/password/change', { currentPassword: PW, newPassword: 'another long passphrase' }))
    expect(res.status).toBe(401)
  })
})

describe('identity verification (Signicat flow, mock provider)', () => {
  it('requires a signed-in user to start', async () => {
    expect((await startIdentity(post('/api/v1/auth/signicat/start', {}))).status).toBe(401)
  })

  it('runs start → authorize → callback and marks the user verified', async () => {
    const { cookie } = await register()
    const start = await startIdentity(post('/api/v1/auth/signicat/start', { returnTo: '/onboarding?step=1' }, { cookie }))
    expect(start.status).toBe(200)
    const { authorizeUrl } = await j(start)
    expect(authorizeUrl).toMatch(/mock-authorize\?state=/)

    const auth = await mockAuthorize(get(authorizeUrl, cookie))
    const callbackUrl = auth.headers.get('location')!
    expect(callbackUrl).toMatch(/signicat\/callback\?code=mock&state=/)

    const done = await identityCallback(get(callbackUrl, cookie))
    expect(done.headers.get('location')).toMatch(/^\/verify\/result\?status=ok/)
    const me = await j(await session(get('/api/v1/auth/session', cookie)))
    expect(me.user.identityVerified).toBe(true)
    expect(me.next).toBe('continue')

    // a replayed callback fails
    const replay = await identityCallback(get(callbackUrl, cookie))
    expect(replay.headers.get('location')).toMatch(/status=failed&.*reason=expired|reason=expired/)
    // and a verified user cannot start again
    expect((await startIdentity(post('/api/v1/auth/signicat/start', {}, { cookie }))).status).toBe(409)
  })

  it('will not let another account use the same identity callback', async () => {
    const a = await register()
    const b = await register()
    const { authorizeUrl } = await j(await startIdentity(post('/api/v1/auth/signicat/start', {}, { cookie: a.cookie })))
    const cb = (await mockAuthorize(get(authorizeUrl))).headers.get('location')!
    const res = await identityCallback(get(cb, b.cookie))
    expect(res.headers.get('location')).toMatch(/status=failed/)
    expect((await j(await session(get('/api/v1/auth/session', b.cookie)))).user.identityVerified).toBe(false)
  })

  it('ignores an off-site returnTo', async () => {
    const { cookie } = await register()
    const { authorizeUrl } = await j(await startIdentity(post('/api/v1/auth/signicat/start', { returnTo: 'https://evil.example' }, { cookie })))
    const state = new URL(authorizeUrl, BASE).searchParams.get('state')!
    const row = (await (await getDb()).query<{ return_to: string }>('select return_to from oidc_flows where state=$1', [state])).rows[0]
    expect(row.return_to).toBe('/onboarding?step=1')
  })

  it('reports "not configured" when neither Signicat nor the mock is on', async () => {
    const { cookie } = await register()
    const prev = process.env.SIGNICAT_MOCK
    process.env.SIGNICAT_MOCK = '0'
    try {
      const res = await startIdentity(post('/api/v1/auth/signicat/start', {}, { cookie }))
      expect(res.status).toBe(503)
      expect((await j(res)).error.code).toBe('signicat_not_configured')
    } finally {
      process.env.SIGNICAT_MOCK = prev
    }
  })
})

describe('requirements gate', () => {
  it('asks for identity verification once the identity connector is required', async () => {
    const { cookie } = await register()
    process.env.REQUIRE_IDENTITY = '1'
    try {
      const body = await j(await session(get('/api/v1/auth/session', cookie)))
      expect(body.next).toBe('verify_identity')
    } finally {
      delete process.env.REQUIRE_IDENTITY
    }
  })
})

describe('account deletion', () => {
  it('erases the account with the password and ends the session', async () => {
    const { email, cookie } = await register()
    await (await getDb()).query(`insert into waitlist (email, status, consent_text) values ($1, 'joined', 'test')`, [email])
    const wrong = await deleteMe(post('/api/v1/me', { password: 'nope' }, { cookie, method: 'DELETE' }))
    expect(wrong.status).toBe(401)
    const ok = await deleteMe(post('/api/v1/me', { password: PW }, { cookie, method: 'DELETE' }))
    expect(ok.status).toBe(200)
    const db = await getDb()
    expect((await db.query('select 1 from users where email=$1', [email])).rows).toHaveLength(0)
    expect((await db.query('select 1 from waitlist where email=$1', [email])).rows).toHaveLength(0)
    expect((await j(await session(get('/api/v1/auth/session', cookie)))).authenticated).toBe(false)
  })
})

// keep the module tidy between files
import { afterAll } from 'vitest'
afterAll(async () => {
  await resetDb()
})
