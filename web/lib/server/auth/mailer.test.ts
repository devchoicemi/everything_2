// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mailConfigured, mailFrom, mailProvider } from '@/lib/server/auth/config'
import { inviteMail, outbox, sendMail } from '@/lib/server/auth/mailer'

const KEYS = ['MAIL_PROVIDER', 'MAIL_FROM', 'AHASEND_API_KEY', 'AHASEND_ACCOUNT_ID', 'AHASEND_API_URL', 'RESEND_API_KEY']
const saved: Record<string, string | undefined> = {}
const realFetch = globalThis.fetch
let calls: { url: string; init: RequestInit }[] = []

function mockFetch(status: number, body: unknown) {
  calls = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  outbox.length = 0
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  globalThis.fetch = realFetch
})

const configureAhaSend = () => {
  process.env.MAIL_FROM = 'ChoiceMi <no-reply@choicemi.com>'
  process.env.AHASEND_API_KEY = 'aha-sk-' + 'a'.repeat(64)
  process.env.AHASEND_ACCOUNT_ID = '11111111-2222-3333-4444-555555555555'
}
const hello = { to: 'someone@example.com', subject: 'Hi', text: 'plain', html: '<p>html</p>', headers: { 'List-Unsubscribe': '<https://x/u>' } }

describe('which provider is used', () => {
  it('is none until a provider and a sender are set', () => {
    expect(mailProvider()).toBeNull()
    expect(mailConfigured()).toBe(false)
    process.env.AHASEND_API_KEY = 'k'
    process.env.AHASEND_ACCOUNT_ID = 'id'
    expect(mailProvider()).toBeNull() // no MAIL_FROM yet
  })

  it('needs both the AhaSend key and the account id', () => {
    process.env.MAIL_FROM = 'a@b.co'
    process.env.AHASEND_API_KEY = 'k'
    expect(mailProvider()).toBeNull()
    process.env.AHASEND_ACCOUNT_ID = 'id'
    expect(mailProvider()).toBe('ahasend')
  })

  it('prefers AhaSend when both are set, unless told otherwise', () => {
    configureAhaSend()
    process.env.RESEND_API_KEY = 're_x'
    expect(mailProvider()).toBe('ahasend')
    process.env.MAIL_PROVIDER = 'resend'
    expect(mailProvider()).toBe('resend')
    process.env.MAIL_PROVIDER = 'ahasend'
    delete process.env.AHASEND_API_KEY
    expect(mailProvider()).toBeNull() // asked for AhaSend, which is not fully set: never silently falls back
  })

  it('splits the sender into name and address', () => {
    process.env.MAIL_FROM = 'ChoiceMi <no-reply@choicemi.com>'
    expect(mailFrom()).toEqual({ name: 'ChoiceMi', email: 'no-reply@choicemi.com' })
    process.env.MAIL_FROM = '"ChoiceMi Team" <hello@choicemi.com>'
    expect(mailFrom()).toEqual({ name: 'ChoiceMi Team', email: 'hello@choicemi.com' })
    process.env.MAIL_FROM = 'plain@choicemi.com'
    expect(mailFrom()).toEqual({ email: 'plain@choicemi.com' })
  })
})

describe('AhaSend', () => {
  it('sends the v2 request AhaSend documents, with tracking off', async () => {
    configureAhaSend()
    mockFetch(202, { object: 'list', data: [{ object: 'message', id: 'm1', recipient: { email: hello.to }, status: 'queued', error: null }] })
    expect(await sendMail(hello)).toBe(true)

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.ahasend.com/v2/accounts/11111111-2222-3333-4444-555555555555/messages')
    const h = calls[0].init.headers as Record<string, string>
    expect(h.Authorization).toBe(`Bearer ${process.env.AHASEND_API_KEY}`)
    expect(h['Content-Type']).toBe('application/json')
    expect(h['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(calls[0].init.method).toBe('POST')

    const body = JSON.parse(String(calls[0].init.body))
    expect(body).toEqual({
      from: { name: 'ChoiceMi', email: 'no-reply@choicemi.com' },
      recipients: [{ email: 'someone@example.com' }],
      subject: 'Hi',
      text_content: 'plain',
      html_content: '<p>html</p>',
      headers: { 'List-Unsubscribe': '<https://x/u>' },
      tracking: { open: false, click: false },
    })
  })

  it('sends the invitation email with its personal link intact', async () => {
    configureAhaSend()
    process.env.SESSION_SECRET = 'secret-for-test-links'
    mockFetch(202, { object: 'list', data: [{ status: 'queued' }] })
    await sendMail(inviteMail('new@example.com', 'TOKEN123', 14))
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.subject).toMatch(/invitation/i)
    expect(body.text_content).toContain('/signup?invite=TOKEN123')
    expect(body.html_content).toContain('Create my account')
    expect(body.headers['List-Unsubscribe']).toMatch(/waitlist\/unsubscribe/)
  })

  it('reports failure when AhaSend rejects the request', async () => {
    configureAhaSend()
    mockFetch(403, { message: 'domain not verified' })
    expect(await sendMail(hello)).toBe(false)
    mockFetch(401, { message: 'bad key' })
    expect(await sendMail(hello)).toBe(false)
    mockFetch(500, { message: 'oops' })
    expect(await sendMail(hello)).toBe(false)
  })

  it('reports failure when AhaSend accepts the call but cannot queue the message', async () => {
    configureAhaSend()
    mockFetch(202, { object: 'list', data: [{ status: 'error', error: 'recipient suppressed' }] })
    expect(await sendMail(hello)).toBe(false)
  })

  it('reports failure on a network error instead of throwing', async () => {
    configureAhaSend()
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as typeof fetch
    expect(await sendMail(hello)).toBe(false)
  })

  it('never calls Resend while AhaSend is the provider', async () => {
    configureAhaSend()
    process.env.RESEND_API_KEY = 're_x'
    mockFetch(202, { data: [{ status: 'queued' }] })
    await sendMail(hello)
    expect(calls.every((c) => c.url.startsWith('https://api.ahasend.com'))).toBe(true)
  })
})

describe('Resend (kept as the fallback)', () => {
  it('still works', async () => {
    process.env.MAIL_FROM = 'ChoiceMi <no-reply@choicemi.com>'
    process.env.RESEND_API_KEY = 're_test'
    mockFetch(200, { id: 'x' })
    expect(await sendMail(hello)).toBe(true)
    expect(calls[0].url).toBe('https://api.resend.com/emails')
    expect(JSON.parse(String(calls[0].init.body)).from).toBe('ChoiceMi <no-reply@choicemi.com>')
  })
})

describe('no provider', () => {
  it('captures mail in development and tests', async () => {
    expect(await sendMail(hello)).toBe(true)
    expect(outbox).toHaveLength(1)
  })
})
