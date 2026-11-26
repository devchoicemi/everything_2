// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { POST as logout } from '@/app/api/v1/auth/logout/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { GET as getProfile, PUT as putProfile } from '@/app/api/v1/me/profile/route'
import { DELETE as deleteMe } from '@/app/api/v1/me/route'
import { GET as getPool } from '@/app/api/v1/questions/pool/route'
import { GET as adminPool, PATCH as adminToggle, POST as adminAdd } from '@/app/api/v1/admin/questions/route'
import { STATIC_POOL } from '@/lib/questionPool'
import { STORY_PROMPTS } from '@/lib/profile/quality'

const BASE = 'http://localhost:3000'
const ADMIN = 'c'.repeat(48)
const PW = 'correct horse battery'
let n = 0
const j = async (r: Response) => r.json() as Promise<any>

const req = (path: string, init: { method?: string; body?: unknown; cookie?: string; admin?: boolean } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-forwarded-for': `10.40.0.${++n}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.admin ? { authorization: `Bearer ${ADMIN}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]

async function register() {
  const email = `prof${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true } }))
  return { email, cookie: cookieOf(res) }
}

const STORY = Object.fromEntries(STORY_PROMPTS.map((p) => [p.id, p.example]))
const PROFILE = {
  onboarding: { city: 'Helsinki', intent: 'Serious relationship', headline: 'Slow mornings', consentSensitive: true, lifestyle: ['Non-smoker'] },
  compatDraft: { height: { field: 'height', self: 178, ideal: { h_170_179: 100 }, weight: 60, dealbreaker: false } },
  aiDraft: { prompts: STORY, extra: '', rawText: Object.values(STORY).join(' '), layout: 'bloom', approved: false },
  poolPicks: STATIC_POOL.slice(0, 4).map((q) => ({ id: q.id, question: q.question, options: q.options, answer: q.options[0] })),
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.ADMIN_TOKEN = ADMIN
  await getDb()
}, 60_000)
afterAll(async () => {
  await resetDb()
})

describe('saved profile and sign-in routing', () => {
  it('needs a signed-in member', async () => {
    expect((await getProfile(req('/api/v1/me/profile'))).status).toBe(401)
    expect((await putProfile(req('/api/v1/me/profile', { method: 'PUT', body: { data: {} } }))).status).toBe(401)
  })

  it('starts not onboarded, with nothing saved', async () => {
    const { cookie } = await register()
    expect(await j(await getProfile(req('/api/v1/me/profile', { cookie })))).toEqual({ onboarded: false, data: {} })
    const s = await j(await session(req('/api/v1/auth/session', { cookie })))
    expect(s.user.onboarded).toBe(false)
  })

  it('saves progress without finishing, and keeps only the known parts', async () => {
    const { cookie } = await register()
    const res = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: { ...PROFILE, evil: 'x', isAdmin: true } } }))
    expect(res.status).toBe(200)
    const out = await j(res)
    expect(out.onboarded).toBe(false)
    expect(Object.keys(out.data).sort()).toEqual(['aiDraft', 'compatDraft', 'onboarding', 'poolPicks'])
  })

  it('will not finish setup with filler text, even if the screen was bypassed', async () => {
    const { cookie } = await register()
    const finish = (aiDraft: unknown) =>
      putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: { ...PROFILE, aiDraft }, complete: true } }))
    for (const junk of ['123445566', 'asdfgh jklqwe zxcvbn qwerty uiopas dfghjk', 'blah blah blah blah blah blah blah blah blah blah']) {
      const filler = Object.fromEntries(STORY_PROMPTS.map((p) => [p.id, junk]))
      const res = await finish({ prompts: filler, extra: '', rawText: junk })
      expect(res.status, junk).toBe(400)
      expect((await j(res)).error.code).toBe('story_quality')
    }
    // only two good answers is not enough either
    const two = Object.fromEntries(STORY_PROMPTS.slice(0, 2).map((p) => [p.id, p.example]))
    expect((await finish({ prompts: two, extra: '', rawText: '' })).status).toBe(400)
    // and a draft saved without finishing is allowed to be unfinished
    expect((await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: { ...PROFILE, aiDraft: { prompts: { weekend: '123' }, extra: '' } } } }))).status).toBe(200)
  })

  it('will not finish setup without enough real read-check questions', async () => {
    const { cookie } = await register()
    const finish = (poolPicks: unknown) =>
      putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: { ...PROFILE, poolPicks }, complete: true } }))
    const real = PROFILE.poolPicks
    for (const bad of [[], real.slice(0, 3), [{ id: 'made-up', question: 'x', options: ['a', 'b', 'c'], answer: 'a' }, ...real.slice(0, 3)], real.map((p) => ({ ...p, answer: 'not one of the choices' }))]) {
      const res = await finish(bad)
      expect(res.status).toBe(400)
      expect((await j(res)).error.code).toBe('read_check_required')
    }
    expect((await finish(real)).status).toBe(200)
  })

  it('will not finish setup without the consent on record', async () => {
    const { cookie } = await register()
    const noConsent = { ...PROFILE, onboarding: { ...PROFILE.onboarding, consentSensitive: false } }
    const res = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: noConsent, complete: true } }))
    expect(res.status).toBe(400)
    expect((await j(res)).error.code).toBe('consent_required')
  })

  it('REGRESSION: after signing out and back in, a member who finished setup is NOT sent to sign-up again', async () => {
    const { email, cookie } = await register()
    const done = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: PROFILE, complete: true } }))
    expect((await j(done)).onboarded).toBe(true)

    await logout(req('/api/v1/auth/logout', { method: 'POST', cookie, body: {} }))
    const back = await login(req('/api/v1/auth/login', { method: 'POST', body: { email, password: PW } }))
    expect(back.status).toBe(200)
    const body = await j(back)
    expect(body.user.onboarded).toBe(true)

    // and the profile they built is still there
    const saved = await j(await getProfile(req('/api/v1/me/profile', { cookie: cookieOf(back) })))
    expect(saved.onboarded).toBe(true)
    expect(saved.data.aiDraft.layout).toBe('bloom')
    expect(saved.data.poolPicks).toHaveLength(4)
    expect(saved.data.compatDraft.height.self).toBe(178)
  })

  it('rejects an oversized profile', async () => {
    const { cookie } = await register()
    const big = { ...PROFILE, aiDraft: { rawText: 'x'.repeat(130_000) } }
    expect((await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: big } }))).status).toBe(413)
  })

  it('is erased with the account', async () => {
    const { email, cookie } = await register()
    await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: PROFILE, complete: true } }))
    const del = await deleteMe(req('/api/v1/me', { method: 'DELETE', cookie, body: { password: PW } }))
    expect(del.status).toBe(200)
    const db = await getDb()
    expect((await db.query('select 1 from member_profiles mp join users u on u.id = mp.user_id where u.email = $1', [email])).rows).toHaveLength(0)
  })
})

describe('question pool', () => {
  it('needs a signed-in member', async () => {
    expect((await getPool(req('/api/v1/questions/pool'))).status).toBe(401)
  })

  it('serves the starting pool: every question has suggested answers', async () => {
    const { cookie } = await register()
    const body = await j(await getPool(req('/api/v1/questions/pool', { cookie })))
    expect(body.themes.map((t: { id: string }) => t.id)).toEqual(['personality', 'values', 'lifestyle', 'relationship', 'future'])
    expect(body.questions.length).toBe(STATIC_POOL.length)
    for (const q of body.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
      expect(q.options.length).toBeLessThanOrEqual(4)
    }
  })

  it('lets an admin grow the pool, and retire a question', async () => {
    const { cookie } = await register()
    const before = (await j(await getPool(req('/api/v1/questions/pool', { cookie })))).questions.length

    const bad = await adminAdd(req('/api/v1/admin/questions', { method: 'POST', admin: true, body: { theme: 'nope', question: 'A fine question here?', options: ['a', 'b', 'c'] } }))
    expect(bad.status).toBe(400)
    const few = await adminAdd(req('/api/v1/admin/questions', { method: 'POST', admin: true, body: { theme: 'values', question: 'A fine question here?', options: ['a', 'b'] } }))
    expect(few.status).toBe(400)
    expect((await adminAdd(req('/api/v1/admin/questions', { method: 'POST', body: { theme: 'values', question: 'A fine question here?', options: ['a', 'b', 'c'] } }))).status).toBe(401)

    const added = await adminAdd(req('/api/v1/admin/questions', { method: 'POST', admin: true, body: { theme: 'values', question: 'What matters most on a quiet Sunday?', options: ['Rest', 'Family', 'Nature'] } }))
    expect(added.status).toBe(201)
    const id = (await j(added)).question.id

    expect((await j(await getPool(req('/api/v1/questions/pool', { cookie })))).questions.length).toBe(before + 1)
    expect((await j(await adminPool(req('/api/v1/admin/questions', { admin: true })))).questions.some((q: { id: string }) => q.id === id)).toBe(true)

    expect((await adminToggle(req('/api/v1/admin/questions', { method: 'PATCH', admin: true, body: { id, active: false } }))).status).toBe(200)
    expect((await j(await getPool(req('/api/v1/questions/pool', { cookie })))).questions.length).toBe(before)
  })
})
