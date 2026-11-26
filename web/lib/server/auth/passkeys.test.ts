// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { GET as listRoute } from '@/app/api/v1/auth/passkeys/route'
import { DELETE as removeRoute } from '@/app/api/v1/auth/passkeys/[id]/route'
import { POST as regOptions } from '@/app/api/v1/auth/passkeys/register/options/route'
import { POST as regVerify } from '@/app/api/v1/auth/passkeys/register/verify/route'
import { POST as loginOptions } from '@/app/api/v1/auth/passkeys/login/options/route'
import { POST as loginVerify } from '@/app/api/v1/auth/passkeys/login/verify/route'
import { POST as snooze } from '@/app/api/v1/auth/passkeys/snooze/route'
import { VirtualAuthenticator } from '@/lib/server/auth/virtualAuthenticator'

const BASE = 'http://localhost:3000'
const RP_ID = 'localhost'
const PW = 'correct horse battery'
let n = 0
const j = async (r: Response) => r.json() as Promise<any>
const req = (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'x-forwarded-for': `10.80.0.${++n}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]

async function member(role = 'member', confirmed = true) {
  const email = `pk${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { body: { email, password: PW, acceptTerms: true, over18: true } }))
  const user = (await j(res)).user
  const db = await getDb()
  await db.query(`update users set role = $2, email_verified_at = case when $3::boolean then now() end where id = $1`, [user.id, role, confirmed])
  return { id: user.id as string, email, cookie: cookieOf(res) }
}

/** Adds a passkey the way the browser does: options, the device's answer, verify. */
async function addPasskey(m: { id: string; cookie: string }, name = 'Test phone') {
  const device = new VirtualAuthenticator(RP_ID, BASE, m.id)
  const options = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
  const res = await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response: device.register(options), name } }))
  return { device, options, res }
}

async function signInWith(device: VirtualAuthenticator, opts: Parameters<VirtualAuthenticator['assert']>[1] = {}) {
  const { options, challengeId } = await j(await loginOptions(req('/api/v1/auth/passkeys/login/options', { body: {} })))
  const res = await loginVerify(req('/api/v1/auth/passkeys/login/verify', { body: { challengeId, response: device.assert(options, opts) } }))
  return { res, options, challengeId }
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.AUTH_OTP = '1' // codes are on: a passkey must still get in without one
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  delete process.env.APP_BASE_URL
  await getDb()
}, 60_000)
afterAll(async () => {
  delete process.env.AUTH_OTP
  await resetDb()
})

describe('adding a passkey', () => {
  it('registers a device, lists it, and shows it in the session', async () => {
    const m = await member()
    const { res } = await addPasskey(m, 'My laptop')
    expect(res.status).toBe(201)
    const created = (await j(res)).passkey
    expect(created.name).toBe('My laptop')
    const list = await j(await listRoute(req('/api/v1/auth/passkeys', { method: 'GET', cookie: m.cookie })))
    expect(list.passkeys.map((p: { id: string }) => p.id)).toEqual([created.id])
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: m.cookie })))
    expect(s.security.passkeys).toBe(1)
    // only the public key is kept
    const db = await getDb()
    const row = (await db.query<{ public_key: string; credential_id: string }>('select public_key, credential_id from passkeys where user_id = $1', [m.id])).rows[0]
    expect(row.public_key.length).toBeGreaterThan(40)
    expect(row.credential_id).toBeTruthy()
  })

  it('needs a signed-in member with a confirmed email, and is not offered to test accounts', async () => {
    expect((await regOptions(req('/api/v1/auth/passkeys/register/options', { body: {} }))).status).toBe(401)
    const unconfirmed = await member('member', false)
    const r1 = await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: unconfirmed.cookie, body: {} }))
    expect(r1.status).toBe(403)
    expect((await j(r1)).error.code).toBe('email_unverified')
    const tester = await member('tester')
    const r2 = await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: tester.cookie, body: {} }))
    expect(r2.status).toBe(403)
    expect((await j(r2)).error.code).toBe('not_available')
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie: tester.cookie })))
    expect(s.security.exempt).toBe(true)
  })

  it('refuses answers that were not made for this challenge, this site, or without user verification', async () => {
    const m = await member()
    const options = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
    const device = new VirtualAuthenticator(RP_ID, BASE, m.id)
    const send = (response: unknown) => regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response } }))
    // wrong site
    expect((await send(device.register(options, { origin: 'https://evil.example' }))).status).toBe(400)
    // the challenge was just consumed by that attempt: start again for each check
    for (const bad of [{ userVerified: false }]) {
      const fresh = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
      expect((await send(device.register(fresh, bad))).status).toBe(400)
    }
    // a made-up challenge
    expect((await send(device.register({ challenge: 'AAAA' }))).status).toBe(400)
    // and nothing was saved by any of them
    const db = await getDb()
    expect((await db.query('select 1 from passkeys where user_id = $1', [m.id])).rows).toHaveLength(0)
  })

  it('a challenge works once, and not for another member', async () => {
    const m = await member()
    const other = await member()
    const options = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
    const device = new VirtualAuthenticator(RP_ID, BASE, m.id)
    const answer = device.register(options)
    // another member has no challenge of their own
    expect((await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: other.cookie, body: { response: answer } }))).status).toBe(400)
    expect((await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response: answer } }))).status).toBe(201)
    // replaying the same answer fails: the challenge is spent
    expect((await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response: answer } }))).status).toBe(400)
  })

  it('an expired challenge is refused', async () => {
    const m = await member()
    const options = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
    const db = await getDb()
    await db.query(`update webauthn_challenges set expires_at = now() - interval '1 minute' where user_id = $1`, [m.id])
    const device = new VirtualAuthenticator(RP_ID, BASE, m.id)
    expect((await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response: device.register(options) } }))).status).toBe(400)
  })

  it('the same device is not added twice', async () => {
    const m = await member()
    const first = await addPasskey(m)
    expect(first.res.status).toBe(201)
    const options = await j(await regOptions(req('/api/v1/auth/passkeys/register/options', { cookie: m.cookie, body: {} })))
    expect(options.excludeCredentials.map((c: { id: string }) => c.id)).toContain(first.device.id)
    const dup = await regVerify(req('/api/v1/auth/passkeys/register/verify', { cookie: m.cookie, body: { response: first.device.register(options) } }))
    expect(dup.status).toBe(409)
  })

  it('removing one affects only your own', async () => {
    const a = await member()
    const b = await member()
    const pa = (await j((await addPasskey(a)).res)).passkey
    const del = (cookie: string, id: string) => removeRoute(req(`/api/v1/auth/passkeys/${id}`, { method: 'DELETE', cookie }))
    expect((await del(b.cookie, pa.id)).status).toBe(404)
    expect((await del(a.cookie, 'not-an-id')).status).toBe(404)
    expect((await del(a.cookie, pa.id)).status).toBe(200)
    expect((await j(await listRoute(req('/api/v1/auth/passkeys', { method: 'GET', cookie: a.cookie })))).passkeys).toHaveLength(0)
  })
})

describe('signing in with a passkey', () => {
  it('signs in with no password and no emailed code, even though codes are on', async () => {
    const m = await member()
    // sanity: the password route would have asked for a code
    expect((await j(await login(req('/api/v1/auth/login', { body: { email: m.email, password: PW } })))).otpRequired).toBe(true)
    const { device } = await addPasskey(m)
    const { res } = await signInWith(device)
    expect(res.status).toBe(200)
    const cookie = cookieOf(res)
    expect(cookie).toMatch(/^cm_auth=/)
    const s = await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie })))
    expect(s.user.id).toBe(m.id)
    const db = await getDb()
    const ev = (await db.query<{ meta: { via: string } }>(`select meta from auth_events where user_id = $1 and type = 'login' order by id desc limit 1`, [m.id])).rows[0]
    expect(ev.meta.via).toBe('passkey')
  })

  it('counts up, and an answer cannot be replayed', async () => {
    const m = await member()
    const { device } = await addPasskey(m)
    const { options, challengeId, res } = await signInWith(device)
    expect(res.status).toBe(200)
    const db = await getDb()
    expect(Number((await db.query<{ counter: string }>('select counter from passkeys where user_id = $1', [m.id])).rows[0].counter)).toBe(1)
    // the same signed answer again: the challenge is used up
    const replay = await loginVerify(req('/api/v1/auth/passkeys/login/verify', { body: { challengeId, response: device.assert(options, { replayCounter: true }) } }))
    expect(replay.status).toBe(401)
    // a second sign-in works and the counter moves on
    expect((await signInWith(device)).res.status).toBe(200)
    expect(Number((await db.query<{ counter: string }>('select counter from passkeys where user_id = $1', [m.id])).rows[0].counter)).toBe(2)
  })

  it('refuses unknown devices, other sites, missing user verification, and removed passkeys', async () => {
    const m = await member()
    const { device } = await addPasskey(m)
    expect((await signInWith(new VirtualAuthenticator(RP_ID, BASE, m.id))).res.status).toBe(401) // never registered
    expect((await signInWith(device, { origin: 'https://evil.example' })).res.status).toBe(401)
    expect((await signInWith(device, { userVerified: false })).res.status).toBe(401)
    expect((await signInWith(device, { credentialId: 'bm90LXJlYWw' })).res.status).toBe(401)
    // junk bodies
    for (const body of [{}, { challengeId: 'x', response: {} }, { challengeId: '00000000-0000-0000-0000-000000000000', response: { id: 'a' } }]) {
      expect((await loginVerify(req('/api/v1/auth/passkeys/login/verify', { body }))).status).toBe(401)
    }
    // still works when everything is right, until it is removed
    expect((await signInWith(device)).res.status).toBe(200)
    const list = await j(await listRoute(req('/api/v1/auth/passkeys', { method: 'GET', cookie: m.cookie })))
    await removeRoute(req(`/api/v1/auth/passkeys/${list.passkeys[0].id}`, { method: 'DELETE', cookie: m.cookie }))
    expect((await signInWith(device)).res.status).toBe(401)
  })

  it('does not sign in a suspended account or a test account', async () => {
    const a = await member()
    const { device: da } = await addPasskey(a)
    const db = await getDb()
    await db.query(`update users set status = 'suspended' where id = $1`, [a.id])
    expect((await signInWith(da)).res.status).toBe(401)

    const t = await member()
    const { device: dt } = await addPasskey(t)
    await db.query(`update users set role = 'tester' where id = $1`, [t.id])
    expect((await signInWith(dt)).res.status).toBe(401)
  })

  it('is erased with the account', async () => {
    const m = await member()
    await addPasskey(m)
    const db = await getDb()
    await db.query('delete from users where id = $1', [m.id])
    expect((await db.query('select 1 from passkeys where user_id = $1', [m.id])).rows).toHaveLength(0)
  })
})

describe('the optional passkey suggestion', () => {
  const suggested = async (cookie: string) =>
    (await j(await session(req('/api/v1/auth/session', { method: 'GET', cookie })))).security.suggestPasskey as boolean

  it('is suggested to a member with none, and "not now" keeps it away for a week', async () => {
    const m = await member()
    expect(await suggested(m.cookie)).toBe(true)
    expect((await snooze(req('/api/v1/auth/passkeys/snooze', { cookie: m.cookie, body: {} }))).status).toBe(200)
    expect(await suggested(m.cookie)).toBe(false)
    const db = await getDb()
    const days = (await db.query<{ d: number }>(`select extract(epoch from (passkey_prompt_snoozed_until - now())) / 86400 as d from users where id = $1`, [m.id])).rows[0].d as unknown as string | number
    expect(Number(days)).toBeGreaterThan(6.9)
    expect(Number(days)).toBeLessThan(7.1)
    // when the week is up it is suggested again
    await db.query(`update users set passkey_prompt_snoozed_until = now() - interval '1 minute' where id = $1`, [m.id])
    expect(await suggested(m.cookie)).toBe(true)
  })

  it('is not suggested once they have a passkey, to test accounts, or before the email is confirmed', async () => {
    const m = await member()
    await addPasskey(m)
    expect(await suggested(m.cookie)).toBe(false)
    // removing it brings the suggestion back
    const list = await j(await listRoute(req('/api/v1/auth/passkeys', { method: 'GET', cookie: m.cookie })))
    await removeRoute(req(`/api/v1/auth/passkeys/${list.passkeys[0].id}`, { method: 'DELETE', cookie: m.cookie }))
    expect(await suggested(m.cookie)).toBe(true)

    expect(await suggested((await member('tester')).cookie)).toBe(false)
    expect(await suggested((await member('member', false)).cookie)).toBe(false)
  })

  it('needs a signed-in member to snooze', async () => {
    expect((await snooze(req('/api/v1/auth/passkeys/snooze', { body: {} }))).status).toBe(401)
  })
})
