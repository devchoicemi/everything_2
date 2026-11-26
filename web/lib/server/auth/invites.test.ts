// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { outbox, unsubscribeToken } from '@/lib/server/auth/mailer'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as joinList } from '@/app/api/v1/waitlist/route'
import { POST as unsubscribe } from '@/app/api/v1/waitlist/unsubscribe/route'
import { GET as checkInvite } from '@/app/api/v1/invites/check/route'
import { GET as adminList } from '@/app/api/v1/admin/waitlist/route'
import { POST as adminInvite } from '@/app/api/v1/admin/invites/route'
import { GET as session } from '@/app/api/v1/auth/session/route'

const BASE = 'http://localhost:3000'
const ADMIN = 'a'.repeat(48)
let n = 0
const email = () => `wl${++n}-${Date.now()}@example.com`
const j = async (r: Response) => r.json() as Promise<any>

function post(path: string, body: unknown, opts: { admin?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-forwarded-for': opts.ip ?? `10.7.0.${++n}` }
  if (opts.admin !== null && opts.admin !== undefined) headers.authorization = `Bearer ${opts.admin}`
  return new Request(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}
const getReq = (path: string, admin?: string) =>
  new Request(`${BASE}${path}`, { headers: { 'x-forwarded-for': `10.8.0.${++n}`, ...(admin ? { authorization: `Bearer ${admin}` } : {}) } })

const join = (e: string, extra: Record<string, unknown> = {}) => joinList(post('/api/v1/waitlist', { email: e, consent: true, ...extra }))
const body = (e: string, extra: Record<string, unknown> = {}) => ({ email: e, password: 'correct horse battery', acceptTerms: true, over18: true, ...extra })
const tokenFrom = (mail: { text: string }) => /invite=([\w-]+)/.exec(mail.text)![1]

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.ADMIN_TOKEN = ADMIN
  process.env.SIGNUP_MODE = 'invite'
  process.env.SESSION_SECRET = 'test-secret-for-unsubscribe-links'
  delete process.env.RESEND_API_KEY
  await getDb()
}, 60_000)
afterAll(async () => {
  process.env.SIGNUP_MODE = 'open'
  await resetDb()
})
beforeEach(() => {
  outbox.length = 0
})

describe('waitlist', () => {
  it('stores the email with consent and sends a welcome mail with an unsubscribe link', async () => {
    const e = email()
    const res = await join(e)
    expect(res.status).toBe(200)
    const row = (await (await getDb()).query<any>('select * from waitlist where email=$1', [e])).rows[0]
    expect(row.status).toBe('waiting')
    expect(row.consent_text).toMatch(/Agreed to be emailed/)
    expect(outbox.at(-1)?.to).toBe(e)
    expect(outbox.at(-1)?.text).toMatch(/waitlist\/unsubscribe\?e=/)
    expect(outbox.at(-1)?.headers?.['List-Unsubscribe']).toBeTruthy()
  })

  it('answers the same for a duplicate and sends nothing the second time', async () => {
    const e = email()
    await join(e.toUpperCase())
    outbox.length = 0
    const again = await join(e)
    expect(again.status).toBe(200)
    expect(outbox).toHaveLength(0)
    expect((await (await getDb()).query('select 1 from waitlist where email=$1', [e])).rows).toHaveLength(1)
  })

  it('requires consent and a real email', async () => {
    expect((await joinList(post('/api/v1/waitlist', { email: email(), consent: false }))).status).toBe(400)
    expect((await joinList(post('/api/v1/waitlist', { email: 'nope', consent: true }))).status).toBe(400)
  })

  it('ignores bots that fill the hidden field', async () => {
    const e = email()
    expect((await join(e, { company: 'Acme' })).status).toBe(200)
    expect((await (await getDb()).query('select 1 from waitlist where email=$1', [e])).rows).toHaveLength(0)
  })

  it('rate limits one address', async () => {
    const ip = '203.0.113.50'
    let last = 0
    for (let i = 0; i < 10; i++) last = (await joinList(post('/api/v1/waitlist', { email: email(), consent: true }, { ip }))).status
    expect(last).toBe(429)
  })

  it('unsubscribes with the signed link only, and erases the row', async () => {
    const e = email()
    await join(e)
    expect((await unsubscribe(post('/api/v1/waitlist/unsubscribe', { email: e, token: 'forged' }))).status).toBe(400)
    expect((await unsubscribe(post('/api/v1/waitlist/unsubscribe', { email: e, token: unsubscribeToken(e) }))).status).toBe(200)
    expect((await (await getDb()).query('select 1 from waitlist where email=$1', [e])).rows).toHaveLength(0)
  })
})

describe('invite-only sign-up', () => {
  it('refuses sign-up without an invitation and says so in the session config', async () => {
    const res = await signup(post('/api/v1/auth/signup', body(email())))
    expect(res.status).toBe(403)
    expect((await j(res)).error.code).toBe('invite_required')
    expect((await j(await session(getReq('/api/v1/auth/session')))).config.signupMode).toBe('invite')
  })

  it('refuses a made-up invitation', async () => {
    const res = await signup(post('/api/v1/auth/signup', body(email(), { inviteToken: 'made-up' })))
    expect(res.status).toBe(403)
    expect((await j(res)).error.code).toBe('invite_invalid')
  })
})

describe('admin API', () => {
  it('is closed without the right token', async () => {
    expect((await adminList(getReq('/api/v1/admin/waitlist'))).status).toBe(401)
    expect((await adminList(getReq('/api/v1/admin/waitlist', 'wrong'.repeat(10)))).status).toBe(401)
    expect((await adminInvite(post('/api/v1/admin/invites', { limit: 1 }))).status).toBe(401)
  })

  it('is switched off when no ADMIN_TOKEN is set', async () => {
    delete process.env.ADMIN_TOKEN
    try {
      expect((await adminList(getReq('/api/v1/admin/waitlist', ADMIN))).status).toBe(503)
    } finally {
      process.env.ADMIN_TOKEN = ADMIN
    }
  })

  it('lists the waitlist with counts', async () => {
    await join(email())
    const body = await j(await adminList(getReq('/api/v1/admin/waitlist?status=waiting', ADMIN)))
    expect(body.counts.waiting).toBeGreaterThan(0)
    expect(body.entries[0]).toHaveProperty('email')
  })

  it('dry run reports who would be invited and changes nothing', async () => {
    const e = email()
    await join(e)
    outbox.length = 0
    const out = await j(await adminInvite(post('/api/v1/admin/invites', { emails: [e], dryRun: true }, { admin: ADMIN })))
    expect(out).toMatchObject({ dryRun: true, requested: 1, sent: 0 })
    expect(outbox).toHaveLength(0)
    expect((await (await getDb()).query<any>('select status from waitlist where email=$1', [e])).rows[0].status).toBe('waiting')
  })

  it('runs the whole path: waitlist, invite email, sign-up with the link, verified account', async () => {
    const e = email()
    await join(e)
    outbox.length = 0

    const sent = await j(await adminInvite(post('/api/v1/admin/invites', { emails: [e] }, { admin: ADMIN })))
    expect(sent).toMatchObject({ requested: 1, sent: 1, failed: 0 })
    const mail = outbox.at(-1)!
    expect(mail.to).toBe(e)
    expect(mail.subject).toMatch(/invitation/i)
    expect(mail.html).toContain('Create my account')
    const token = tokenFrom(mail)
    expect((await (await getDb()).query<any>('select status from waitlist where email=$1', [e])).rows[0].status).toBe('invited')

    // the sign-up page can look the invite up
    expect(await j(await checkInvite(getReq(`/api/v1/invites/check?token=${token}`)))).toEqual({ valid: true, email: e, role: 'member' })
    expect(await j(await checkInvite(getReq('/api/v1/invites/check?token=nope')))).toEqual({ valid: false })

    // wrong email for this link is refused and the invite survives
    const wrong = await signup(post('/api/v1/auth/signup', body(email(), { inviteToken: token })))
    expect(wrong.status).toBe(403)

    const ok = await signup(post('/api/v1/auth/signup', body(e, { inviteToken: token })))
    expect(ok.status).toBe(201)
    const created = await j(ok)
    expect(created.user.emailVerified).toBe(true)
    expect(outbox.filter((m) => /Confirm your email/.test(m.subject))).toHaveLength(0)
    expect((await (await getDb()).query<any>('select status, joined_at from waitlist where email=$1', [e])).rows[0]).toMatchObject({ status: 'joined' })

    // the link works once
    const reuse = await signup(post('/api/v1/auth/signup', body(e, { inviteToken: token })))
    expect([403, 409]).toContain(reuse.status)
    expect((await j(await checkInvite(getReq(`/api/v1/invites/check?token=${token}`)))).valid).toBe(false)
  })

  it('invites the oldest waiting people first, up to the limit, and not twice', async () => {
    const a = email()
    const b = email()
    await join(a)
    await join(b)
    // park everyone else so only a and b are waiting
    await (await getDb()).query(`update waitlist set status = 'joined' where email not in ($1, $2)`, [a, b])
    outbox.length = 0
    const first = await j(await adminInvite(post('/api/v1/admin/invites', { limit: 1 }, { admin: ADMIN })))
    expect(first).toMatchObject({ sent: 1, remainingWaiting: 1, emails: [a] })
    const second = await j(await adminInvite(post('/api/v1/admin/invites', { limit: 5 }, { admin: ADMIN })))
    expect(second).toMatchObject({ sent: 1, remainingWaiting: 0, emails: [b] })
    const third = await j(await adminInvite(post('/api/v1/admin/invites', { limit: 5 }, { admin: ADMIN })))
    expect(third.sent).toBe(0)
  })

  it('a re-invite replaces the earlier link', async () => {
    const e = email()
    await join(e)
    outbox.length = 0
    await adminInvite(post('/api/v1/admin/invites', { emails: [e] }, { admin: ADMIN }))
    const first = tokenFrom(outbox.at(-1)!)
    await adminInvite(post('/api/v1/admin/invites', { emails: [e] }, { admin: ADMIN }))
    const second = tokenFrom(outbox.at(-1)!)
    expect(first).not.toBe(second)
    expect((await j(await checkInvite(getReq(`/api/v1/invites/check?token=${first}`)))).valid).toBe(false)
    expect((await j(await checkInvite(getReq(`/api/v1/invites/check?token=${second}`)))).valid).toBe(true)
  })

  it('only invites non-listed emails when allowDirect is set', async () => {
    const e = email()
    const blocked = await j(await adminInvite(post('/api/v1/admin/invites', { emails: [e] }, { admin: ADMIN })))
    expect(blocked).toMatchObject({ sent: 0, skipped: 1 })
    const allowed = await j(await adminInvite(post('/api/v1/admin/invites', { emails: [e], allowDirect: true }, { admin: ADMIN })))
    expect(allowed.sent).toBe(1)
  })

  it('refuses to send when no email provider is configured in production', async () => {
    const prev = process.env.NODE_ENV
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    try {
      const res = await adminInvite(post('/api/v1/admin/invites', { limit: 1 }, { admin: ADMIN }))
      expect(res.status).toBe(409)
      expect((await j(res)).error.code).toBe('mail_not_configured')
    } finally {
      ;(process.env as Record<string, string>).NODE_ENV = prev ?? 'test'
    }
  })

  it('does not leave a person marked invited when the email fails to send', async () => {
    const e = email()
    await join(e)
    process.env.RESEND_API_KEY = 'x'
    process.env.MAIL_FROM = 'a@b.co'
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('nope', { status: 422 })) as typeof fetch
    try {
      const out = await j(await adminInvite(post('/api/v1/admin/invites', { emails: [e] }, { admin: ADMIN })))
      expect(out).toMatchObject({ sent: 0, failed: 1 })
      expect((await (await getDb()).query<any>('select status from waitlist where email=$1', [e])).rows[0].status).toBe('waiting')
      expect((await (await getDb()).query('select 1 from invites where email=$1 and used_at is null', [e])).rows).toHaveLength(0)
    } finally {
      globalThis.fetch = realFetch
      delete process.env.RESEND_API_KEY
      delete process.env.MAIL_FROM
    }
  })
})
