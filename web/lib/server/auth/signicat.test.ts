// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { CompactEncrypt, SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { pkceChallenge } from '@/lib/server/auth/crypto'
import { claimsFrom, isOver18, resetSignicatCache } from '@/lib/server/auth/signicat'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as start } from '@/app/api/v1/auth/signicat/start/route'
import { GET as callback } from '@/app/api/v1/auth/signicat/callback/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { GET as adminIdentity } from '@/app/api/v1/admin/identity/route'
import { randomBytes } from 'node:crypto'

/**
 * A fake Signicat: discovery, JWKS and a token endpoint that checks the client
 * secret and PKCE verifier, then returns an ID token that is signed (RS256)
 * and then encrypted (RSA-OAEP / A128CBC-HS256), exactly as Signicat does when
 * "Encrypt ID tokens" is on.
 */
const CLIENT_ID = 'test-client'
const CLIENT_SECRET = 'test-secret'
const BASE = 'http://localhost:3000'

let server: http.Server
let issuerBase = ''
let signKey: CryptoKey
let encPublic: CryptoKey
let encPrivateJwk: JWK
let pendingChallenge = ''
let claimsToIssue: Record<string, unknown> = {}
let lastAuthorizeQuery = new URLSearchParams()
let tokenCalls = 0

const j = async (r: Response) => r.json() as Promise<any>
let n = 0
async function newUser() {
  const res = await signup(
    new Request(`${BASE}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.9.0.${++n}` },
      body: JSON.stringify({ email: `idp${n}-${Date.now()}@example.com`, password: 'correct horse battery', acceptTerms: true, over18: true }),
    }),
  )
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

async function begin(cookie: string) {
  const res = await start(
    new Request(`${BASE}/api/v1/auth/signicat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, 'x-forwarded-for': '10.9.9.9' },
      body: JSON.stringify({ returnTo: '/onboarding?step=1' }),
    }),
  )
  const { authorizeUrl } = await j(res)
  const u = new URL(authorizeUrl)
  lastAuthorizeQuery = u.searchParams
  pendingChallenge = u.searchParams.get('code_challenge')!
  return u
}

beforeAll(async () => {
  const sig = await generateKeyPair('RS256', { extractable: true })
  signKey = sig.privateKey
  const signJwk = { ...(await exportJWK(sig.publicKey)), kid: 'sig-1', alg: 'RS256', use: 'sig' }
  const enc = await generateKeyPair('RSA-OAEP', { extractable: true })
  encPublic = enc.publicKey
  encPrivateJwk = await exportJWK(enc.privateKey)

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, issuerBase)
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === '/auth/open/.well-known/openid-configuration') {
      return send(200, {
        issuer: `${issuerBase}/auth/open`,
        authorization_endpoint: `${issuerBase}/auth/open/connect/authorize`,
        token_endpoint: `${issuerBase}/auth/open/connect/token`,
        jwks_uri: `${issuerBase}/auth/open/connect/jwks`,
      })
    }
    if (url.pathname === '/auth/open/connect/jwks') return send(200, { keys: [signJwk] })
    if (url.pathname === '/auth/open/connect/token' && req.method === 'POST') {
      tokenCalls++
      let raw = ''
      for await (const chunk of req) raw += chunk
      const form = new URLSearchParams(raw)
      const basic = Buffer.from((req.headers.authorization ?? '').replace('Basic ', ''), 'base64').toString()
      if (basic !== `${CLIENT_ID}:${CLIENT_SECRET}`) return send(401, { error: 'invalid_client' })
      if (pkceChallenge(form.get('code_verifier') ?? '') !== pendingChallenge) return send(400, { error: 'invalid_grant' })
      if (form.get('code') !== 'good-code') return send(400, { error: 'invalid_grant' })
      const signed = await new SignJWT({ ...claimsToIssue, nonce: lastAuthorizeQuery.get('nonce') })
        .setProtectedHeader({ alg: 'RS256', kid: 'sig-1' })
        .setIssuer(`${issuerBase}/auth/open`)
        .setAudience(CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(signKey)
      const id_token = await new CompactEncrypt(new TextEncoder().encode(signed))
        .setProtectedHeader({ alg: 'RSA-OAEP', enc: 'A128CBC-HS256', cty: 'JWT' })
        .encrypt(encPublic)
      return send(200, { id_token, access_token: 'unused', token_type: 'Bearer' })
    }
    send(404, {})
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  issuerBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNICAT_MOCK = '0'
  process.env.SIGNICAT_BASE_URL = issuerBase
  process.env.SIGNICAT_DOMAIN = 'fake.example'
  process.env.SIGNICAT_CLIENT_ID = CLIENT_ID
  process.env.SIGNICAT_CLIENT_SECRET = CLIENT_SECRET
  process.env.SIGNICAT_ENC_PRIVATE_JWK = JSON.stringify(encPrivateJwk)
  process.env.APP_BASE_URL = BASE
  process.env.IDENTITY_DATA_KEY = randomBytes(32).toString('base64')
  process.env.ADMIN_TOKEN = 'b'.repeat(48)
  resetSignicatCache()
  await getDb()
}, 60_000)

afterAll(async () => {
  server.close()
  await resetDb()
})

describe('Signicat OIDC (fake provider, encrypted ID token)', () => {
  it('builds a PKCE authorize URL with state, nonce and the FTN idp', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    expect(u.origin + u.pathname).toBe(`${issuerBase}/auth/open/connect/authorize`)
    const q = u.searchParams
    expect(q.get('response_type')).toBe('code')
    expect(q.get('client_id')).toBe(CLIENT_ID)
    expect(q.get('redirect_uri')).toBe(`${BASE}/api/v1/auth/signicat/callback`)
    expect(q.get('scope')).toBe('openid profile')
    expect(q.get('acr_values')).toBe('idp:ftn')
    expect(q.get('code_challenge_method')).toBe('S256')
    expect(q.get('state')!.length).toBeGreaterThan(20)
    expect(q.get('nonce')!.length).toBeGreaterThan(20)
  })

  it('exchanges the code, decrypts + verifies the ID token and verifies an adult', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    claimsToIssue = { sub: 'ftn-subject-1', birthdate: '1990-05-17', idp: 'ftn', name: 'Aino Virtanen', national_id: '010190-123A' }
    const res = await callback(
      new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }),
    )
    expect(res.headers.get('location')).toMatch(/^\/verify\/result\?status=ok/)
    const me = await j(await session(new Request(`${BASE}/api/v1/auth/session`, { headers: { cookie } })))
    expect(me.user.identityVerified).toBe(true)

    const db = await getDb()
    const row = (await db.query<Record<string, unknown>>('select * from identities where subject = $1', ['ftn-subject-1'])).rows[0]
    expect(row).toMatchObject({ provider: 'signicat', idp: 'ftn', over18: true })
    // the name is stored, but only as ciphertext
    expect(row.name_enc).toMatch(/^v1\./)
    expect(JSON.stringify(row)).not.toContain('Aino')
    expect(JSON.stringify(row)).not.toContain('010190')
    expect(Object.keys(row)).not.toContain('birthdate')
    // never returned to the member
    expect(JSON.stringify(me)).not.toContain('Aino')
  })

  it('lets only the audited admin lookup read the name', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    claimsToIssue = { sub: 'ftn-lookup', birthdate: '1988-02-02', idp: 'ftn', given_name: 'Mikko', family_name: 'Korhonen' }
    await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
    const db = await getDb()
    const email = (await db.query<{ email: string }>(`select u.email from users u join identities i on i.user_id = u.id where i.subject = 'ftn-lookup'`)).rows[0].email

    const ask = (token?: string) =>
      adminIdentity(new Request(`${BASE}/api/v1/admin/identity?email=${encodeURIComponent(email)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }))
    expect((await ask()).status).toBe(401)
    expect((await ask('wrong'.repeat(12))).status).toBe(401)

    const before = (await db.query<{ n: number }>(`select count(*)::int n from auth_events where type = 'admin_identity_viewed'`)).rows[0].n
    const ok = await j(await ask('b'.repeat(48)))
    expect(ok).toMatchObject({ verified: true, idp: 'ftn', over18: true, legalName: 'Mikko Korhonen' })
    const after = (await db.query<{ n: number }>(`select count(*)::int n from auth_events where type = 'admin_identity_viewed'`)).rows[0].n
    expect(after).toBe(before + 1)
  })

  it('stores no name when the encryption key is not set', async () => {
    const saved = process.env.IDENTITY_DATA_KEY
    delete process.env.IDENTITY_DATA_KEY
    try {
      const cookie = await newUser()
      const u = await begin(cookie)
      claimsToIssue = { sub: 'ftn-nokey', birthdate: '1991-03-03', idp: 'ftn', name: 'Should Not Persist' }
      const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
      expect(res.headers.get('location')).toMatch(/status=ok/)
      const row = (await (await getDb()).query<Record<string, unknown>>('select * from identities where subject = $1', ['ftn-nokey'])).rows[0]
      expect(row.name_enc).toBeNull()
    } finally {
      process.env.IDENTITY_DATA_KEY = saved
    }
  })

  it('rejects under-18s without verifying them', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    const year = new Date().getUTCFullYear() - 16
    claimsToIssue = { sub: 'ftn-minor', birthdate: `${year}-01-01`, idp: 'ftn' }
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
    expect(res.headers.get('location')).toMatch(/status=failed&.*reason=underage/)
    const me = await j(await session(new Request(`${BASE}/api/v1/auth/session`, { headers: { cookie } })))
    expect(me.user.identityVerified).toBe(false)
  })

  it('refuses a second account with the same verified identity', async () => {
    const a = await newUser()
    const ua = await begin(a)
    claimsToIssue = { sub: 'ftn-shared', birthdate: '1985-03-03', idp: 'ftn' }
    await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${ua.searchParams.get('state')}`, { headers: { cookie: a } }))

    const b = await newUser()
    const ub = await begin(b)
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${ub.searchParams.get('state')}`, { headers: { cookie: b } }))
    expect(res.headers.get('location')).toMatch(/reason=already_linked/)
  })

  it('fails safely when the provider rejects the code', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=bad-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
    expect(res.headers.get('location')).toMatch(/reason=verification_failed/)
  })

  it('handles the user cancelling at the provider', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?error=access_denied&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
    expect(res.headers.get('location')).toMatch(/reason=cancelled/)
  })

  it('rejects an ID token with the wrong nonce', async () => {
    const cookie = await newUser()
    const u = await begin(cookie)
    lastAuthorizeQuery = new URLSearchParams({ nonce: 'something-else' }) // provider signs a different nonce
    claimsToIssue = { sub: 'ftn-nonce', birthdate: '1980-01-01', idp: 'ftn' }
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=${u.searchParams.get('state')}`, { headers: { cookie } }))
    expect(res.headers.get('location')).toMatch(/reason=verification_failed/)
  })

  it('rejects an unknown or replayed state without calling the provider', async () => {
    const cookie = await newUser()
    const before = tokenCalls
    const res = await callback(new Request(`${BASE}/api/v1/auth/signicat/callback?code=good-code&state=made-up`, { headers: { cookie } }))
    expect(res.headers.get('location')).toMatch(/reason=expired/)
    expect(tokenCalls).toBe(before)
  })
})

describe('claim helpers', () => {
  it('computes adulthood from birthdate exactly on the 18th birthday', () => {
    const now = new Date(Date.UTC(2026, 9, 8))
    expect(isOver18('2008-10-08', now)).toBe(true)
    expect(isOver18('2008-10-09', now)).toBe(false)
    expect(isOver18(undefined, now)).toBe(false)
    expect(isOver18('not-a-date', now)).toBe(false)
  })
  it('requires a subject', () => {
    expect(() => claimsFrom({ birthdate: '1990-01-01' })).toThrow()
  })
})
