// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { PUT as putMine } from '@/app/api/v1/me/compatibility/route'
import { PUT as putProfile } from '@/app/api/v1/me/profile/route'
import { GET as discover } from '@/app/api/v1/discover/route'
import { GET as readStatus } from '@/app/api/v1/members/[id]/read-check/route'
import { POST as readStart } from '@/app/api/v1/members/[id]/read-check/start/route'
import { POST as readAnswer } from '@/app/api/v1/members/[id]/read-check/answer/route'
import { POST as like } from '@/app/api/v1/members/[id]/like/route'
import { POST as pass } from '@/app/api/v1/members/[id]/pass/route'
import { GET as listMatches } from '@/app/api/v1/matches/route'
import { GET as getMatch } from '@/app/api/v1/matches/[id]/route'
import { POST as unmatch } from '@/app/api/v1/matches/[id]/unmatch/route'
import { GET as listVenues } from '@/app/api/v1/venues/route'
import { GET as venueSlots } from '@/app/api/v1/venues/[id]/slots/route'
import { GET as listBookings } from '@/app/api/v1/bookings/route'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { STATIC_POOL } from '@/lib/questionPool'
import { STORY_PROMPTS } from '@/lib/profile/quality'
import type { CompatVariableInput } from '@/lib/compat/types'

const BASE = 'http://localhost:3000'
const PW = 'correct horse battery'
let n = 0
const j = async (r: Response) => r.json() as Promise<any>

const req = (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-forwarded-for': `10.60.0.${++n}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]

function variables(): CompatVariableInput[] {
  return VARIABLE_CATALOG.map((c) =>
    c.shape === 'MULTI_SELECT'
      ? { field: c.field, self: ['Reading', 'Hiking'], ideal: ['Reading', 'Cooking'], weight: 40, dealbreaker: false }
      : {
          field: c.field,
          self: c.shape === 'BUCKETED_CONTINUOUS' ? (c.field === 'height' ? 175 : 29) : (c.options as { key: string }[])[0].key,
          ideal: Object.fromEntries((c.options as { key: string }[]).map((o, i) => [o.key, 50 + i * 10])),
          weight: 50,
          dealbreaker: false,
        },
  )
}

const story = Object.fromEntries(STORY_PROMPTS.map((p) => [p.id, p.example]))
const PICKS = STATIC_POOL.slice(0, 4).map((q) => ({ id: q.id, question: q.question, options: q.options, answer: q.options[0] }))
const profileData = (gender: string, interestedIn: string[]) => ({
  onboarding: { gender, interestedIn, city: 'Helsinki', intent: 'Serious relationship', headline: 'Test member', lifestyle: ['Non-smoker'], consentSensitive: true },
  aiDraft: { prompts: story, extra: '', rawText: Object.values(story).join('\n\n'), layout: 'bloom', approved: false },
  poolPicks: PICKS,
})

type M = { id: string; username: string; cookie: string }
async function member(gender: string, interestedIn: string[], opts: { picks?: boolean } = {}): Promise<M> {
  const email = `soc${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true } }))
  const cookie = cookieOf(res)
  const user = (await j(res)).user
  const db = await getDb()
  await db.query(`update users set identity_verified_at = now(), role = 'tester' where id = $1`, [user.id])
  await putMine(req('/api/v1/me/compatibility', { method: 'PUT', cookie, body: { variables: variables() } }))
  const data = profileData(gender, interestedIn)
  const done = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data, complete: true } }))
  if (done.status !== 200) throw new Error('profile failed ' + JSON.stringify(await done.json()))
  if (opts.picks === false) {
    // saving progress later may clear them; only finishing setup needs them
    await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: { ...data, poolPicks: [] } } }))
  }
  return { id: user.id, username: user.username, cookie }
}

const get = (h: (r: Request) => Promise<Response>, path: string, who: M) => h(req(path, { cookie: who.cookie }))
const post = (h: (r: Request) => Promise<Response>, path: string, who: M, body?: unknown) => h(req(path, { method: 'POST', cookie: who.cookie, body: body ?? {} }))

/** Read the target's profile and pass the read-check, the way a reader does. */
async function passCheck(reader: M, target: M) {
  const start = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
  const right = PICKS.find((p) => p.id === start.question.questionId)!
  const out = await j(await post(readAnswer, `/api/v1/members/${target.id}/read-check/answer`, reader, { questionId: start.question.questionId, selectedOption: right.answer }))
  expect(out.status).toBe('passed')
}

const FUTURE = () => {
  const d = new Date(Date.now() + 5 * 86_400_000)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  delete process.env.APP_LAUNCHED
  await getDb()
}, 60_000)
afterAll(async () => {
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

describe('read-check on accounts', () => {
  it('serves the same question until it is answered, never reveals the answer, and keeps choices stable', async () => {
    const reader = await member('man', ['Women'])
    const target = await member('woman', ['Men'])
    const a = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
    const b = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
    expect(a.status).toBe('active')
    expect(a.attemptsRemaining).toBe(3)
    expect(b.question).toEqual(a.question)
    expect(JSON.stringify(a)).not.toMatch(/correct/i)
    const pick = PICKS.find((p) => p.id === a.question.questionId)!
    expect([...a.question.options].sort()).toEqual([...pick.options].sort())
  })

  it('blocks the pair for 24 hours after three wrong answers, and passing opens likes', async () => {
    const reader = await member('man', ['Women'])
    const target = await member('woman', ['Men'])
    let cur = (await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))).question
    let last: any
    for (let i = 0; i < 3; i++) {
      const wrong = PICKS.find((p) => p.id === cur.questionId)!.options.find((o) => o !== PICKS[0].options[0] && o !== PICKS.find((p) => p.id === cur.questionId)!.answer)!
      last = await j(await post(readAnswer, `/api/v1/members/${target.id}/read-check/answer`, reader, { questionId: cur.questionId, selectedOption: wrong }))
      if (last.nextQuestion) cur = last.nextQuestion
    }
    expect(last.status).toBe('blocked')
    expect(last.blockedUntil).toBeGreaterThan(Date.now() + 23 * 3_600_000)
    const again = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
    expect(again.status).toBe('blocked')
    expect(again.question).toBeNull()
    const st = await j(await get(readStatus, `/api/v1/members/${target.id}/read-check`, reader))
    expect(st.status).toBe('blocked')
    // blocked readers cannot like
    expect((await post(like, `/api/v1/members/${target.id}/like`, reader)).status).toBe(403)
  })

  it('refuses an answer for a question that is not the live one', async () => {
    const reader = await member('man', ['Women'])
    const target = await member('woman', ['Men'])
    const start = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
    const other = PICKS.find((p) => p.id !== start.question.questionId)!
    const out = await j(await post(readAnswer, `/api/v1/members/${target.id}/read-check/answer`, reader, { questionId: other.id, selectedOption: other.answer }))
    expect(out.correct).toBe(false)
    expect(out.attemptsUsed).toBe(0)
  })

  it('needs the member to have set up questions, and only works on members you can see', async () => {
    const reader = await member('man', ['Women'])
    const bare = await member('woman', ['Men'], { picks: false })
    const r = await post(readStart, `/api/v1/members/${bare.id}/read-check/start`, reader)
    expect(r.status).toBe(409)
    expect((await j(r)).error.code).toBe('no_read_check')
    // a member whose orientation does not fit is simply not there
    const wrong = await member('man', ['Men'])
    expect((await post(readStart, `/api/v1/members/${wrong.id}/read-check/start`, reader)).status).toBe(404)
    expect((await post(readStart, `/api/v1/members/not-a-uuid/read-check/start`, reader)).status).toBe(404)
  })

  it('needs sign-in', async () => {
    expect((await readStart(req('/api/v1/members/x/read-check/start', { method: 'POST', body: {} }))).status).toBe(401)
  })
})

describe('likes, passes and mutual matches', () => {
  it('a like needs the read-check; a one-sided like is not a match; a mutual like is', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    expect((await post(like, `/api/v1/members/${b.id}/like`, a)).status).toBe(403)

    await passCheck(a, b)
    const first = await j(await post(like, `/api/v1/members/${b.id}/like`, a))
    expect(first).toMatchObject({ mutual: false, matchId: null })
    expect(first.score).toBeGreaterThan(0)
    expect((await j(await get(listMatches, '/api/v1/matches', a))).matches.some((m: any) => m.memberId === b.id)).toBe(false)

    // liking again changes nothing
    expect((await j(await post(like, `/api/v1/members/${b.id}/like`, a))).mutual).toBe(false)

    await passCheck(b, a)
    const second = await j(await post(like, `/api/v1/members/${a.id}/like`, b))
    expect(second.mutual).toBe(true)
    expect(second.matchId).toMatch(/^[0-9a-f-]{36}$/)

    // both see it, with the other member's profile
    for (const [me, other] of [[a, b], [b, a]] as const) {
      const list = (await j(await get(listMatches, '/api/v1/matches', me))).matches
      const m = list.find((x: any) => x.id === second.matchId)
      expect(m.memberId).toBe(other.id)
      expect(m.username).toBe(other.username)
      expect(m.age).toBe(29)
      expect(m.window).toMatchObject({ from: expect.any(String), to: expect.any(String) })
      expect(m.openBookingStatus).toBe('proposed')
      expect(m.cv.answers.length).toBe(4)
      expect(m.cv.lookingFor).toEqual([])
      expect(m.score).toBeGreaterThan(0)
    }
    const one = await j(await get(getMatch, `/api/v1/matches/${second.matchId}`, a))
    expect(one.match.id).toBe(second.matchId)
  })

  it('a pass hides the member from the deck for good and cannot be turned into a like', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    const inDeck = async (who: M, id: string) => (await j(await get(discover, '/api/v1/discover', who))).members.some((m: any) => m.id === id)
    expect(await inDeck(a, b.id)).toBe(true)
    expect((await post(pass, `/api/v1/members/${b.id}/pass`, a)).status).toBe(200)
    expect(await inDeck(a, b.id)).toBe(false)
    await passCheck(a, b)
    expect((await post(like, `/api/v1/members/${b.id}/like`, a)).status).toBe(409)
  })

  it('liked and matched members leave the deck, and the deck carries what the cards need', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    const deck = (await j(await get(discover, '/api/v1/discover', a))).members.find((m: any) => m.id === b.id)
    expect(deck).toMatchObject({ username: b.username, age: 29, city: 'Helsinki', intent: 'Serious relationship' })
    expect(deck.reasons.length).toBeGreaterThan(0)
    expect(deck.cv.answers.map((x: any) => x.q)).toEqual(PICKS.map((p) => p.question))
    await passCheck(a, b)
    await post(like, `/api/v1/members/${b.id}/like`, a)
    expect((await j(await get(discover, '/api/v1/discover', a))).members.some((m: any) => m.id === b.id)).toBe(false)
  })

  it('unmatching ends the match for both', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    await passCheck(a, b)
    await passCheck(b, a)
    await post(like, `/api/v1/members/${b.id}/like`, a)
    const m = await j(await post(like, `/api/v1/members/${a.id}/like`, b))
    expect((await post(unmatch, `/api/v1/matches/${m.matchId}/unmatch`, a)).status).toBe(200)
    for (const who of [a, b]) {
      expect((await j(await get(listMatches, '/api/v1/matches', who))).matches).toHaveLength(0)
    }
    expect((await get(getMatch, `/api/v1/matches/${m.matchId}`, b)).status).toBe(404)
  })

  it('strangers cannot read someone else\'s match', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    const c = await member('man', ['Women'])
    await passCheck(a, b)
    await passCheck(b, a)
    await post(like, `/api/v1/members/${b.id}/like`, a)
    const m = await j(await post(like, `/api/v1/members/${a.id}/like`, b))
    expect((await get(getMatch, `/api/v1/matches/${m.matchId}`, c)).status).toBe(404)
    expect((await post(unmatch, `/api/v1/matches/${m.matchId}/unmatch`, c)).status).toBe(404)
  })

  it('regular members cannot browse or react before launch', async () => {
    const a = await member('man', ['Women'])
    const b = await member('woman', ['Men'])
    const db = await getDb()
    await db.query(`update users set role = 'member' where id = $1`, [a.id])
    expect((await get(discover, '/api/v1/discover', a)).status).toBe(403)
    expect((await post(like, `/api/v1/members/${b.id}/like`, a)).status).toBe(403)
    expect((await get(listMatches, '/api/v1/matches', a)).status).toBe(403)
    expect((await get(listBookings, '/api/v1/bookings', a)).status).toBe(403)
  })
})

async function matched(): Promise<{ a: M; b: M; matchId: string }> {
  const a = await member('man', ['Women'])
  const b = await member('woman', ['Men'])
  await passCheck(a, b)
  await passCheck(b, a)
  await post(like, `/api/v1/members/${b.id}/like`, a)
  const m = await j(await post(like, `/api/v1/members/${a.id}/like`, b))
  return { a, b, matchId: m.matchId }
}

describe('venues and slots', () => {
  it('lists the venues and the six start times, free by default', async () => {
    const a = await member('man', ['Women'])
    const venues = (await j(await get(listVenues, '/api/v1/venues', a))).venues
    expect(venues.map((v: any) => v.name)).toEqual(['Kaffa Roastery', 'Good Life Coffee', 'Café Regatta', 'Fazer Café'])
    const slots = (await j(await get(venueSlots, `/api/v1/venues/${venues[0].id}/slots?date=${FUTURE()}`, a))).slots
    expect(slots.map((s: any) => s.time)).toEqual(['12:00', '13:30', '15:00', '16:30', '18:00', '19:00'])
    expect(slots.every((s: any) => s.available)).toBe(true)
    expect((await get(venueSlots, `/api/v1/venues/${venues[0].id}/slots?date=2026-02-31`, a)).status).toBe(400)
    expect((await get(venueSlots, `/api/v1/venues/nope/slots?date=${FUTURE()}`, a)).status).toBe(404)
  })
})
