import { expect } from 'vitest'
import { getDb } from '@/lib/server/db'
import { POST as signup } from '@/app/api/v1/auth/signup/route'
import { PUT as putMine } from '@/app/api/v1/me/compatibility/route'
import { PUT as putProfile } from '@/app/api/v1/me/profile/route'
import { POST as readStart } from '@/app/api/v1/members/[id]/read-check/start/route'
import { POST as readAnswer } from '@/app/api/v1/members/[id]/read-check/answer/route'
import { POST as like } from '@/app/api/v1/members/[id]/like/route'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { STATIC_POOL } from '@/lib/questionPool'
import { STORY_PROMPTS } from '@/lib/profile/quality'
import type { CompatVariableInput } from '@/lib/compat/types'

/** Shared set-up for tests that need real members, a match and a partner account. */
export const BASE = 'http://localhost:3000'
export const PW = 'correct horse battery'
let n = 0
export const j = async (r: Response) => r.json() as Promise<any>

export const req = (path: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-forwarded-for': `10.77.${Math.floor(++n / 250)}.${(n % 250) + 1}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
export const cookieOf = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0]

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
export const PICKS = STATIC_POOL.slice(0, 4).map((q) => ({ id: q.id, question: q.question, options: q.options, answer: q.options[0] }))
const profileData = (gender: string, interestedIn: string[]) => ({
  onboarding: { gender, interestedIn, city: 'Helsinki', intent: 'Serious relationship', headline: 'Test member', lifestyle: ['Non-smoker'], consentSensitive: true },
  aiDraft: { prompts: story, extra: '', rawText: Object.values(story).join('\n\n'), layout: 'bloom', approved: false },
  poolPicks: PICKS,
})

export type M = { id: string; username: string; cookie: string }

export async function member(gender: string, interestedIn: string[]): Promise<M> {
  const email = `kit${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true } }))
  const cookie = cookieOf(res)
  const user = (await j(res)).user
  const db = await getDb()
  await db.query(`update users set identity_verified_at = now(), role = 'tester' where id = $1`, [user.id])
  await putMine(req('/api/v1/me/compatibility', { method: 'PUT', cookie, body: { variables: variables() } }))
  const done = await putProfile(req('/api/v1/me/profile', { method: 'PUT', cookie, body: { data: profileData(gender, interestedIn), complete: true } }))
  if (done.status !== 200) throw new Error('profile failed ' + JSON.stringify(await done.json()))
  return { id: user.id, username: user.username, cookie }
}

export const get = (h: (r: Request) => Promise<Response>, path: string, who: { cookie: string }) => h(req(path, { cookie: who.cookie }))
export const post = (h: (r: Request) => Promise<Response>, path: string, who: { cookie: string }, body?: unknown) => h(req(path, { method: 'POST', cookie: who.cookie, body: body ?? {} }))
export const put = (h: (r: Request) => Promise<Response>, path: string, who: { cookie: string }, body?: unknown) => h(req(path, { method: 'PUT', cookie: who.cookie, body: body ?? {} }))
export const del = (h: (r: Request) => Promise<Response>, path: string, who: { cookie: string }) => h(req(path, { method: 'DELETE', cookie: who.cookie }))

export async function passCheck(reader: M, target: M) {
  const start = await j(await post(readStart, `/api/v1/members/${target.id}/read-check/start`, reader))
  const right = PICKS.find((p) => p.id === start.question.questionId)!
  const out = await j(await post(readAnswer, `/api/v1/members/${target.id}/read-check/answer`, reader, { questionId: start.question.questionId, selectedOption: right.answer }))
  expect(out.status).toBe('passed')
}

/** Two members who like each other. The match starts a booking in the `proposed` state. */
export async function matched(): Promise<{ a: M; b: M; matchId: string; bookingId: string }> {
  const a = await member('man', ['Women'])
  const b = await member('woman', ['Men'])
  await passCheck(a, b)
  await passCheck(b, a)
  await post(like, `/api/v1/members/${b.id}/like`, a)
  const m = await j(await post(like, `/api/v1/members/${a.id}/like`, b))
  const db = await getDb()
  const booking = (await db.query<{ id: string }>('select id from bookings where match_id = $1', [m.matchId])).rows[0]
  return { a, b, matchId: m.matchId, bookingId: booking.id }
}

/** A partner account for a venue, set up straight in the database (the sign-up and onboarding screens have their own tests). */
export async function partnerFor(venueId: string, role: 'owner' | 'staff' = 'owner'): Promise<{ id: string; email: string; cookie: string }> {
  const email = `partner${++n}-${Date.now()}@example.com`
  const res = await signup(req('/api/v1/auth/signup', { method: 'POST', body: { email, password: PW, acceptTerms: true, over18: true } }))
  const user = (await j(res)).user
  const db = await getDb()
  await db.query(`update users set role = 'partner', email_verified_at = now() where id = $1`, [user.id])
  await db.query('insert into venue_staff (user_id, venue_id, role) values ($1, $2, $3)', [user.id, venueId, role])
  return { id: user.id, email, cookie: cookieOf(res) }
}

export const plusDays = (k: number) => new Date(Date.now() + k * 86_400_000).toISOString().slice(0, 10)
export const SLOTS = ['12:00', '13:30', '15:00', '16:30', '18:00', '19:00']

/** Three different options at one venue. Days are counted from today in the 5 to 10 day window. */
export function options(venueId: string, days = [6, 7, 8], time = '15:00') {
  return days.map((d, i) => ({ venueId, dateKey: plusDays(d), time: i === 0 ? time : SLOTS[(SLOTS.indexOf(time) + i) % SLOTS.length] }))
}

export async function notificationsFor(userId: string, code?: string): Promise<{ no: number; code: string; title: string; body: string }[]> {
  const db = await getDb()
  const { rows } = await db.query<{ no: number; code: string; title: string; body: string }>(
    `select event_no as no, code, title, body from notifications where user_id = $1 ${code ? 'and code = $2' : ''} order by created_at, id`,
    code ? [userId, code] : [userId],
  )
  return rows
}

let slotCounter = 0
/** Options on a slot nobody else in the test run is using, so shared tables never run out. */
export function freshOptions(venueId: string) {
  const k = slotCounter++
  const day = 6 + (k % 4)
  const t = Math.floor(k / 4) % SLOTS.length
  return [0, 1, 2].map((i) => ({ venueId, dateKey: plusDays(i === 0 ? day : 6 + ((k + i) % 4)), time: i === 0 ? SLOTS[t] : SLOTS[(t + i) % SLOTS.length] }))
}

/**
 * A tiny JPEG with the given size (and optionally the date the camera says it was taken). It is only a header
 * and some padding: enough for the upload rules, which read the file's own header and nothing else.
 */
export function fakeJpeg(opts: { width: number; height: number; takenAt?: Date; bytes?: number }): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]
  if (opts.takenAt) {
    const d = opts.takenAt
    const p = (n: number, w = 2) => String(n).padStart(w, '0')
    const stamp = `${d.getUTCFullYear()}:${p(d.getUTCMonth() + 1)}:${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}\0`
    const tiff = Buffer.alloc(44 + stamp.length)
    tiff.write('II', 0, 'ascii')
    tiff.writeUInt16LE(0x2a, 2)
    tiff.writeUInt32LE(8, 4)
    tiff.writeUInt16LE(1, 8) // IFD0: one entry, the pointer to the Exif block
    tiff.writeUInt16LE(0x8769, 10)
    tiff.writeUInt16LE(4, 12)
    tiff.writeUInt32LE(1, 14)
    tiff.writeUInt32LE(26, 18)
    tiff.writeUInt32LE(0, 22)
    tiff.writeUInt16LE(1, 26) // Exif block: DateTimeOriginal
    tiff.writeUInt16LE(0x9003, 28)
    tiff.writeUInt16LE(2, 30)
    tiff.writeUInt32LE(stamp.length, 32)
    tiff.writeUInt32LE(44, 36)
    tiff.writeUInt32LE(0, 40)
    tiff.write(stamp, 44, 'ascii')
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff])
    const head = Buffer.alloc(4)
    head.writeUInt8(0xff, 0)
    head.writeUInt8(0xe1, 1)
    head.writeUInt16BE(body.length + 2, 2)
    parts.push(head, body)
  }
  const sof = Buffer.alloc(19)
  sof.writeUInt8(0xff, 0)
  sof.writeUInt8(0xc0, 1)
  sof.writeUInt16BE(17, 2)
  sof.writeUInt8(8, 4)
  sof.writeUInt16BE(opts.height, 5)
  sof.writeUInt16BE(opts.width, 7)
  sof.writeUInt8(3, 9)
  parts.push(sof, Buffer.alloc(Math.max(64, (opts.bytes ?? 2048) - 40), 0x11), Buffer.from([0xff, 0xd9]))
  return Buffer.concat(parts)
}

export function multipart(path: string, cookie: string, fields: Record<string, string | { name: string; type: string; data: Buffer }>, method = 'POST') {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') form.append(k, v)
    else form.append(k, new File([new Uint8Array(v.data)], v.name, { type: v.type }))
  }
  return new Request(`${BASE}${path}`, { method, body: form, headers: { cookie, 'x-forwarded-for': `10.78.${Math.floor(++n / 250)}.${(n % 250) + 1}` } })
}
