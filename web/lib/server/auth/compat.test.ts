// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { GET as getMine, PUT as putMine } from '@/app/api/v1/me/compatibility/route'
import { PUT as putProfile } from '@/app/api/v1/me/profile/route'
import { GET as pairRoute } from '@/app/api/v1/compatibility/[userId]/route'
import { GET as discover } from '@/app/api/v1/discover/route'
import { GET as session } from '@/app/api/v1/auth/session/route'
import { compatibilityScore } from '@/lib/compat/engine'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { STORY_PROMPTS } from '@/lib/profile/quality'
import { STATIC_POOL } from '@/lib/questionPool'
import type { CompatVariableInput } from '@/lib/compat/types'

const BASE = 'http://localhost:3000'
const PW = 'correct horse battery'
let n = 0
const j = async (r: Response) => r.json() as Promise<any>

const req = (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-forwarded-for': `10.50.0.${++n}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]

/** A full, valid set of answers. `over` tweaks individual variables. */
function variables(over: Record<string, Partial<CompatVariableInput>> = {}): CompatVariableInput[] {
  return VARIABLE_CATALOG.map((c) => {
    const base: CompatVariableInput =
      c.shape === 'MULTI_SELECT'
        ? { field: c.field, self: ['Reading', 'Hiking'], ideal: ['Reading', 'Cooking'], weight: 40, dealbreaker: false }
        : {
            field: c.field,
            self: c.shape === 'BUCKETED_CONTINUOUS' ? (c.field === 'height' ? 175 : 29) : (c.options as { key: string }[])[0].key,
            ideal: Object.fromEntries((c.options as { key: string }[]).map((o, i) => [o.key, 50 + i * 10])),
            weight: 50,
            dealbreaker: false,
          }
    return { ...base, ...(over[c.field] ?? {}) }
  })
}

const story = Object.fromEntries(STORY_PROMPTS.map((p) => [p.id, p.example]))
function profileData(gender: string, interestedIn: string[], headline = 'Test member') {
  return {
    onboarding: { gender, interestedIn, city: 'Helsinki', intent: 'Serious relationship', headline, lifestyle: ['Non-smoker'], consentSensitive: true },
    aiDraft: { prompts: story, extra: '', rawText: Object.values(story).join('\n\n'), layout: 'bloom', approved: false },
    poolPicks: STATIC_POOL.slice(0, 4).map((q) => ({ id: q.id, question: q.question, options: q.options, answer: q.options[0] })),
  }
}

async function member(opts: { gender: string; interestedIn: string[]; vars?: CompatVariableInput[]; role?: string; finish?: boolean; saveCompat?: boolean }) {
  const email = `cm${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true } }))
  const cookie = cookieOf(res)
  const user = (await j(res)).user
  const db = await getDb()
  await db.query(`update users set identity_verified_at = now(), role = $2 where id = $1`, [user.id, opts.role ?? 'tester'])
  if (opts.saveCompat !== false) {
    const put = await putMine(req('/api/v1/me/compatibility', { method: 'PUT', cookie, body: { variables: opts.vars ?? variables() } }))
    if (put.status !== 200) throw new Error('compat save failed: ' + JSON.stringify(await put.json()))
  }
  if (opts.finish !== false) {
    const done = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: profileData(opts.gender, opts.interestedIn), complete: true } }))
    if (done.status !== 200) throw new Error('profile complete failed: ' + JSON.stringify(await done.json()))
  }
  return { ...user, cookie } as { id: string; username: string; cookie: string }
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  delete process.env.APP_LAUNCHED // before launch: only admin and tester accounts see each other
  await getDb()
}, 60_000)
afterAll(async () => {
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

describe('member usernames', () => {
  it('every new member gets a unique anonymous username', async () => {
    const a = await member({ gender: 'man', interestedIn: ['Women'], saveCompat: false, finish: false })
    const b = await member({ gender: 'man', interestedIn: ['Women'], saveCompat: false, finish: false })
    expect(a.username).toMatch(/^[A-Z][a-z]+_[A-Z][a-z]+\d*$|^Member_\d+$/)
    expect(a.username).not.toBe(b.username)
    const s = await j(await session(req('/api/v1/auth/session', { cookie: a.cookie })))
    expect(s.user.username).toBe(a.username)
  })
})

describe('saving compatibility answers', () => {
  it('needs a signed-in member', async () => {
    expect((await getMine(req('/api/v1/me/compatibility'))).status).toBe(401)
    expect((await putMine(req('/api/v1/me/compatibility', { method: 'PUT', body: { variables: variables() } }))).status).toBe(401)
  })

  it('round-trips a complete set exactly', async () => {
    const m = await member({ gender: 'man', interestedIn: ['Women'], saveCompat: false, finish: false })
    expect(await j(await getMine(req('/api/v1/me/compatibility', { cookie: m.cookie })))).toMatchObject({ complete: false, variables: [] })
    const vars = variables({ smoking: { weight: 80, dealbreaker: true } })
    expect((await putMine(req('/api/v1/me/compatibility', { method: 'PUT', cookie: m.cookie, body: { variables: vars } }))).status).toBe(200)
    const back = await j(await getMine(req('/api/v1/me/compatibility', { cookie: m.cookie })))
    expect(back.complete).toBe(true)
    expect(back.variables).toHaveLength(VARIABLE_CATALOG.length)
    const smoking = back.variables.find((v: CompatVariableInput) => v.field === 'smoking')
    expect(smoking).toMatchObject({ weight: 80, dealbreaker: true })
  })

  it('enforces the spec rules on the server', async () => {
    const m = await member({ gender: 'man', interestedIn: ['Women'], saveCompat: false, finish: false })
    const put = (vars: unknown) => putMine(req('/api/v1/me/compatibility', { method: 'PUT', cookie: m.cookie, body: { variables: vars } }))

    // three dealbreakers in one category (max two)
    const three = variables({ height: { dealbreaker: true }, age: { dealbreaker: true }, smoking: { dealbreaker: true } })
    const r1 = await put(three)
    expect(r1.status).toBe(422)
    expect(JSON.stringify(await j(r1))).toMatch(/at most 2 dealbreakers/)

    // weight out of range
    expect((await put(variables({ height: { weight: 5 } }))).status).toBe(422)
    expect((await put(variables({ height: { weight: 101 } }))).status).toBe(422)

    // an option left unrated
    const unrated = variables()
    ;(unrated.find((v) => v.field === 'smoking')!.ideal as Record<string, number>) = { non_smoker: 100 }
    expect((await put(unrated)).status).toBe(422)

    // a variable missing, an unknown variable, a duplicate
    expect((await put(variables().slice(1))).status).toBe(422)
    expect((await put([...variables(), { field: 'nonsense', self: 'x', ideal: {}, weight: 50, dealbreaker: false }])).status).toBe(422)
    expect((await put([...variables(), variables()[0]])).status).toBe(422)

    // nothing was saved by the failures
    expect((await j(await getMine(req('/api/v1/me/compatibility', { cookie: m.cookie })))).complete).toBe(false)
    expect((await put('nope')).status).toBe(400)
  })
})

describe('compatibility between two members', () => {
  it('matches the engine exactly (spec section 10) and returns it in the documented shape', async () => {
    const aVars = variables({ smoking: { self: 'non_smoker', ideal: { non_smoker: 100, occasional: 40, regular: 5 }, weight: 70 } })
    const bVars = variables({ smoking: { self: 'regular', ideal: { non_smoker: 80, occasional: 60, regular: 50 }, weight: 30 }, height: { self: 188 } })
    const a = await member({ gender: 'man', interestedIn: ['Women'], vars: aVars })
    const b = await member({ gender: 'woman', interestedIn: ['Men'], vars: bVars })

    const res = await pairRoute(req(`/api/v1/compatibility/${b.id}`, { cookie: a.cookie }))
    expect(res.status).toBe(200)
    const body = await j(res)

    const expected = compatibilityScore({ userId: 'a', variables: aVars }, { userId: 'b', variables: bVars })
    expect(body.final).toBe(expected.final)
    expect(body.byCategory).toEqual(expected.byCategory)
    expect(body.you.percent).toBe(expected.aToB.percent)
    expect(body.them.percent).toBe(expected.bToA.percent)
    expect(body.member).toEqual({ id: b.id, username: b.username })

    // symmetric: both members see the same headline number
    const back = await j(await pairRoute(req(`/api/v1/compatibility/${a.id}`, { cookie: b.cookie })))
    expect(back.final).toBe(body.final)
  })

  it('never reveals the other member\'s individual ratings', async () => {
    const a = await member({ gender: 'man', interestedIn: ['Women'] })
    const b = await member({ gender: 'woman', interestedIn: ['Men'] })
    const body = await j(await pairRoute(req(`/api/v1/compatibility/${b.id}`, { cookie: a.cookie })))
    expect(Object.keys(body.them)).toEqual(['percent'])
    expect(JSON.stringify(body)).not.toMatch(/bToA|aToB|"ideal"/)
  })

  it('is closed to strangers, to yourself, and to unfinished or unknown members', async () => {
    const a = await member({ gender: 'man', interestedIn: ['Women'] })
    const unfinished = await member({ gender: 'woman', interestedIn: ['Men'], finish: false })
    expect((await pairRoute(req(`/api/v1/compatibility/${a.id}`))).status).toBe(401)
    expect((await pairRoute(req(`/api/v1/compatibility/${a.id}`, { cookie: a.cookie }))).status).toBe(400)
    expect((await pairRoute(req(`/api/v1/compatibility/${unfinished.id}`, { cookie: a.cookie }))).status).toBe(404)
    expect((await pairRoute(req('/api/v1/compatibility/not-an-id', { cookie: a.cookie }))).status).toBe(404)
    expect((await pairRoute(req('/api/v1/compatibility/00000000-0000-0000-0000-000000000000', { cookie: a.cookie }))).status).toBe(404)
  })

  it('needs my own answers first', async () => {
    const noCompat = await member({ gender: 'man', interestedIn: ['Women'], saveCompat: false, finish: false })
    const other = await member({ gender: 'woman', interestedIn: ['Men'] })
    const res = await pairRoute(req(`/api/v1/compatibility/${other.id}`, { cookie: noCompat.cookie }))
    expect([409]).toContain(res.status)
  })
})

describe('before launch', () => {
  it('ordinary members cannot browse anyone, and cannot be browsed by testers', async () => {
    const tester = await member({ gender: 'man', interestedIn: ['Women'] })
    const ordinary = await member({ gender: 'woman', interestedIn: ['Men'], role: 'member' })
    expect((await discover(req('/api/v1/discover', { cookie: ordinary.cookie }))).status).toBe(403)
    expect((await pairRoute(req(`/api/v1/compatibility/${tester.id}`, { cookie: ordinary.cookie }))).status).toBe(403)
    expect((await pairRoute(req(`/api/v1/compatibility/${ordinary.id}`, { cookie: tester.cookie }))).status).toBe(404)
    const feed = (await j(await discover(req('/api/v1/discover', { cookie: tester.cookie })))).members
    expect(feed.some((m: { id: string }) => m.id === ordinary.id)).toBe(false)
  })

  it('after launch, ordinary members can browse', async () => {
    process.env.APP_LAUNCHED = '1'
    try {
      const x = await member({ gender: 'woman', interestedIn: ['Men'], role: 'member' })
      const y = await member({ gender: 'man', interestedIn: ['Women'], role: 'member' })
      const feed = (await j(await discover(req('/api/v1/discover', { cookie: x.cookie })))).members
      expect(feed.some((m: { id: string }) => m.id === y.id)).toBe(true)
    } finally {
      delete process.env.APP_LAUNCHED
    }
  })
})

describe('discover feed', () => {
  it('lists real members, best compatibility first, and only where orientation suits both people', async () => {
    const me = await member({
      gender: 'man',
      interestedIn: ['Women'],
      vars: variables({ smoking: { ideal: { non_smoker: 100, occasional: 10, regular: 0 }, weight: 100 } }),
    })
    const good = await member({ gender: 'woman', interestedIn: ['Men'], vars: variables({ smoking: { self: 'non_smoker' } }) })
    const worse = await member({ gender: 'woman', interestedIn: ['Men'], vars: variables({ smoking: { self: 'regular' } }) })
    const notIntoMen = await member({ gender: 'woman', interestedIn: ['Women'] })
    const man = await member({ gender: 'man', interestedIn: ['Women'] }) // I am only into women
    const everyone = await member({ gender: 'woman', interestedIn: ['Everyone'] })

    const feed = (await j(await discover(req('/api/v1/discover', { cookie: me.cookie })))).members as { id: string; score: number; username: string; cv: { lookingFor: unknown[] } }[]
    const ids = feed.map((m) => m.id)
    expect(ids).toContain(good.id)
    expect(ids).toContain(worse.id)
    expect(ids).toContain(everyone.id)
    expect(ids).not.toContain(notIntoMen.id) // she is not into men
    expect(ids).not.toContain(man.id) // I am not into men
    expect(ids).not.toContain(me.id)
    expect(ids.indexOf(good.id)).toBeLessThan(ids.indexOf(worse.id))
    expect(feed.find((m) => m.id === good.id)!.score).toBeGreaterThan(feed.find((m) => m.id === worse.id)!.score)
    // sorted best first
    const scores = feed.map((m) => m.score)
    expect([...scores].sort((x, y) => y - x)).toEqual(scores)
    // the score in the feed is the same one the pair endpoint gives
    const pair = await j(await pairRoute(req(`/api/v1/compatibility/${good.id}`, { cookie: me.cookie })))
    expect(feed.find((m) => m.id === good.id)!.score).toBe(Math.round(pair.final))
    // a member's private "what I want in a partner" is not part of their public card
    expect(feed.every((m) => m.cv.lookingFor.length === 0)).toBe(true)
  })

  it('skips members who have not finished', async () => {
    const me = await member({ gender: 'man', interestedIn: ['Women'] })
    const halfway = await member({ gender: 'woman', interestedIn: ['Men'], finish: false })
    const noCompat = await member({ gender: 'woman', interestedIn: ['Men'], saveCompat: false })
    const feed = (await j(await discover(req('/api/v1/discover', { cookie: me.cookie })))).members as { id: string }[]
    expect(feed.some((m) => m.id === halfway.id)).toBe(false)
    expect(feed.some((m) => m.id === noCompat.id)).toBe(false)
  })

  it('is closed to signed-out visitors', async () => {
    expect((await discover(req('/api/v1/discover'))).status).toBe(401)
  })
})
