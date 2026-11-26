// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDb, resetDb } from '@/lib/server/db'
import { outbox } from '@/lib/server/auth/mailer'
import { smsOutbox } from '@/lib/server/auth/sms'
import { GET as listBookings } from '@/app/api/v1/bookings/route'
import { GET as getBooking } from '@/app/api/v1/bookings/[id]/route'
import { POST as sendOptions } from '@/app/api/v1/bookings/[id]/options/route'
import { POST as pick } from '@/app/api/v1/bookings/[id]/pick/route'
import { POST as none } from '@/app/api/v1/bookings/[id]/none/route'
import { POST as confirm } from '@/app/api/v1/bookings/[id]/confirm/route'
import { POST as withdraw } from '@/app/api/v1/bookings/[id]/withdraw/route'
import { POST as cancel } from '@/app/api/v1/bookings/[id]/cancel/route'
import { POST as late } from '@/app/api/v1/bookings/[id]/late/route'
import { POST as left } from '@/app/api/v1/bookings/[id]/left/route'
import { POST as noShow } from '@/app/api/v1/bookings/[id]/no-show/route'
import { POST as feedback } from '@/app/api/v1/bookings/[id]/feedback/route'
import { POST as redate } from '@/app/api/v1/bookings/[id]/redate/route'
import { POST as report } from '@/app/api/v1/bookings/[id]/report/route'
import { GET as matchBooking } from '@/app/api/v1/matches/[id]/booking/route'
import { POST as unmatch } from '@/app/api/v1/matches/[id]/unmatch/route'
import { GET as notifications } from '@/app/api/v1/notifications/route'
import { POST as tick } from '@/app/api/v1/admin/tick/route'
import { GET as pRequests } from '@/app/api/v1/partner/requests/route'
import { GET as pBookings } from '@/app/api/v1/partner/bookings/route'
import { POST as pConfirm } from '@/app/api/v1/partner/bookings/[id]/confirm/route'
import { POST as pDecline } from '@/app/api/v1/partner/bookings/[id]/decline/route'
import { POST as pCancel } from '@/app/api/v1/partner/bookings/[id]/cancel/route'
import { POST as pEnd } from '@/app/api/v1/partner/bookings/[id]/end/route'
import { POST as pNoShow } from '@/app/api/v1/partner/bookings/[id]/no-show/route'
import { POST as pScan } from '@/app/api/v1/partner/checkin/scan/route'
import { POST as pManual } from '@/app/api/v1/partner/checkin/manual/route'
import { GET as pAttention } from '@/app/api/v1/partner/attention/route'
import { GET as pStats } from '@/app/api/v1/partner/stats/route'
import { GET as venueSlots } from '@/app/api/v1/venues/[id]/slots/route'
import { makeQrToken } from '@/lib/server/booking/qr'
import { cfg } from '@/lib/server/booking/config'
import { freshOptions, get, j, matched, notificationsFor, options, partnerFor, plusDays, post, req } from '@/lib/server/testkit'

const VENUE = 'kaffa-roastery'
const OTHER_VENUE = 'fazer-cafe'
const TICK = 't'.repeat(40)

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite://memory'
  process.env.SIGNUP_MODE = 'open'
  process.env.TICK_SECRET = TICK
  delete process.env.APP_LAUNCHED
  delete process.env.REQUIRE_EMAIL_VERIFICATION
  delete process.env.AUTH_OTP
  await getDb()
}, 60_000)
afterAll(async () => {
  delete process.env.TICK_SECRET
  process.env.APP_LAUNCHED = '1'
  await resetDb()
})

type Who = { id: string; username: string; cookie: string }
const path = (id: string, tail = '') => `/api/v1/bookings/${id}${tail}`
const view = async (id: string, who: Who) => (await j(await get(getBooking, path(id), who))).booking

/** Both people agree an option: a sends three, b picks the first, a confirms. The request is now with the venue. */
async function requested(venue = VENUE) {
  const m = await matched()
  const opts = freshOptions(venue)
  expect((await post(sendOptions, path(m.bookingId, '/options'), m.a, { options: opts })).status).toBe(200)
  const v = await view(m.bookingId, m.b)
  expect((await post(pick, path(m.bookingId, '/pick'), m.b, { optionId: v.options[0].id })).status).toBe(200)
  expect((await post(confirm, path(m.bookingId, '/confirm'), m.a)).status).toBe(200)
  return { ...m, venue, picked: opts[0] }
}

/** The venue says yes. */
async function confirmed(venue = VENUE) {
  const r = await requested(venue)
  const partner = await partnerFor(venue)
  expect((await post(pConfirm, `/api/v1/partner/bookings/${r.bookingId}/confirm`, partner)).status).toBe(200)
  return { ...r, partner }
}

/** Moves the date so that it starts `minutes` from now (negative = already started). */
async function startsIn(bookingId: string, minutes: number) {
  const db = await getDb()
  await db.query(`update bookings set start_at = now() + ($2 || ' minutes')::interval where id = $1`, [bookingId, String(minutes)])
}

describe('planning the date', () => {
  it('a match opens the date window (day 5 to day 10) and tells both people', async () => {
    const m = await matched()
    const b = await view(m.bookingId, m.a)
    const db = await getDb()
    const from = (await db.query<{ d: string }>(`select to_char((now() at time zone 'Europe/Helsinki')::date + $1::int, 'YYYY-MM-DD') as d`, [cfg().windowFromDay])).rows[0].d
    const to = (await db.query<{ d: string }>(`select to_char((now() at time zone 'Europe/Helsinki')::date + $1::int, 'YYYY-MM-DD') as d`, [cfg().windowToDay])).rows[0].d
    expect(b).toMatchObject({ status: 'proposed', kind: 'first', round: 0, window: { from, to } })
    expect(b.ref).toMatch(/^CM-[A-HJ-NP-Z2-9]{5}$/)
    expect(b.actions).toEqual(['send_options'])
    for (const who of [m.a, m.b]) {
      const n = await notificationsFor(who.id)
      expect(n).toHaveLength(1)
      expect(n[0]).toMatchObject({ no: 1, code: 'match_window' })
    }
    expect((await j(await get(matchBooking, `/api/v1/matches/${m.matchId}/booking`, m.a))).booking.id).toBe(m.bookingId)
    expect((await j(await get(listBookings, '/api/v1/bookings', m.b))).bookings[0]).toMatchObject({ id: m.bookingId, needsMe: true })
  })

  it('options are three, inside the window and the venue hours, and different from each other', async () => {
    const m = await matched()
    const go = (body: unknown) => post(sendOptions, path(m.bookingId, '/options'), m.a, { options: body })
    const good = options(VENUE)
    expect((await go(good.slice(0, 2))).status).toBe(400)
    expect((await go([...good, good[0]])).status).toBe(400)
    expect((await go([good[0], good[0], good[1]])).status).toBe(400) // the same twice
    expect((await go([{ ...good[0], dateKey: plusDays(2) }, good[1], good[2]])).status).toBe(400) // too early
    expect((await go([{ ...good[0], dateKey: plusDays(14) }, good[1], good[2]])).status).toBe(400) // after the window
    expect((await go([{ ...good[0], time: '14:00' }, good[1], good[2]])).status).toBe(400) // not an offered start
    expect((await go([{ ...good[0], venueId: 'nope' }, good[1], good[2]])).status).toBe(404)
    expect((await go([{ ...good[0], dateKey: '2026-02-31' }, good[1], good[2]])).status).toBe(400)
    // a note or message has no place in an option
    expect((await go([{ ...good[0], note: 'hello' }, good[1], good[2]])).status).toBe(400)
    // nothing was sent by the failures
    expect((await view(m.bookingId, m.a)).round).toBe(0)
    expect((await go(good)).status).toBe(200)
    expect((await go(good)).status).toBe(409)
  })

  it('a venue that is closed that day or past its last start cannot be offered', async () => {
    const m = await matched()
    const db = await getDb()
    const day = plusDays(7)
    await db.query(`insert into venue_closures (venue_id, date_on, reason) values ($1, $2, 'private event')`, [VENUE, day])
    const closed = await post(sendOptions, path(m.bookingId, '/options'), m.a, { options: options(VENUE, [6, 7, 8]) })
    expect(closed.status).toBe(409)
    expect((await j(closed)).error.code).toBe('venue_closed')
    await db.query(`delete from venue_closures where venue_id = $1`, [VENUE])
    // a venue closing at 20:00 takes its last date at 18:30, so 19:00 is too late
    await db.query(`update venues set hours = '{"0":{"open":"10:00","close":"20:00"},"1":{"open":"10:00","close":"20:00"},"2":{"open":"10:00","close":"20:00"},"3":{"open":"10:00","close":"20:00"},"4":{"open":"10:00","close":"20:00"},"5":{"open":"10:00","close":"20:00"},"6":{"open":"10:00","close":"20:00"}}'::jsonb where id = $1`, [VENUE])
    const slots = (await j(await get(venueSlots, `/api/v1/venues/${VENUE}/slots?date=${plusDays(7)}`, m.a))).slots
    expect(slots.find((s: any) => s.time === '18:00')).toMatchObject({ available: true })
    expect(slots.find((s: any) => s.time === '19:00')).toMatchObject({ available: false, reason: 'too_close_to_closing' })
    await db.query(`update venues set hours = (select jsonb_object_agg(d::text, jsonb_build_object('open', '10:00', 'close', '22:00')) from generate_series(0, 6) d) where id = $1`, [VENUE])
  })

  it('one picks, the sender confirms, and only then does the venue hear of it', async () => {
    const m = await matched()
    const db = await getDb()
    await post(sendOptions, path(m.bookingId, '/options'), m.a, { options: options(VENUE) })
    let b = await view(m.bookingId, m.b)
    expect(b).toMatchObject({ status: 'proposed', round: 1, turn: 'me' })
    expect(b.options).toHaveLength(3)
    expect(b.actions.sort()).toEqual(['none', 'pick'])
    expect((await notificationsFor(m.b.id, 'options_proposed'))).toHaveLength(1)
    // the sender cannot pick their own options, and a stranger cannot see the booking
    expect((await post(pick, path(m.bookingId, '/pick'), m.a, { optionId: b.options[0].id })).status).toBe(409)
    const stranger = await partnerFor(VENUE)
    expect((await get(getBooking, path(m.bookingId), stranger)).status).toBe(403) // partners are not daters

    expect((await post(pick, path(m.bookingId, '/pick'), m.b, { optionId: b.options[1].id })).status).toBe(200)
    b = await view(m.bookingId, m.a)
    expect(b).toMatchObject({ status: 'picked', turn: 'me', actions: ['confirm'] })
    expect((await notificationsFor(m.a.id, 'option_picked'))).toHaveLength(1)
    // nothing has gone to the venue
    expect((await db.query(`select 1 from notifications where audience = 'venue' and booking_id = $1`, [m.bookingId])).rows).toHaveLength(0)
    // only the person who sent the picked option can confirm it
    expect((await post(confirm, path(m.bookingId, '/confirm'), m.b)).status).toBe(403)
    expect((await post(confirm, path(m.bookingId, '/confirm'), m.a)).status).toBe(200)
    expect((await view(m.bookingId, m.b)).status).toBe('requested')
    for (const who of [m.a, m.b]) expect(await notificationsFor(who.id, 'request_sent')).toHaveLength(1)
    const v = (await db.query(`select event_no, channels from notifications where audience = 'venue' and booking_id = $1`, [m.bookingId])).rows
    expect(v).toHaveLength(1)
    expect(v[0].event_no).toBe(8)
  })

  it('None of these needs a reason and three new options, swaps roles, and closes after the last round', async () => {
    const m = await matched()
    const base = path(m.bookingId)
    await post(sendOptions, `${base}/options`, m.a, { options: options(VENUE, [6, 7, 8], '12:00') })
    // no reason, no go
    expect((await post(none, `${base}/none`, m.b, { reasons: [], options: options(VENUE, [6, 7, 8], '13:30') })).status).toBe(400)
    expect((await post(none, `${base}/none`, m.b, { reasons: ['because'], options: options(VENUE, [6, 7, 8], '13:30') })).status).toBe(400)
    // an option that was already turned down cannot come back
    const again = await post(none, `${base}/none`, m.b, { reasons: ['times'], options: options(VENUE, [6, 7, 8], '12:00') })
    expect(again.status).toBe(400)
    expect((await j(again)).error.code).toBe('already_offered')
    // round 2: b answers with three of their own
    expect((await post(none, `${base}/none`, m.b, { reasons: ['times', 'venues'], options: options(OTHER_VENUE, [7, 8, 9], '13:30') })).status).toBe(200)
    const forA = await view(m.bookingId, m.a)
    expect(forA).toMatchObject({ round: 2, turn: 'me' })
    expect(forA.options.every((o: any) => !o.sentByMe)).toBe(true)
    const told = await notificationsFor(m.a.id, 'none_of_these')
    expect(told[0].body).toContain("Times don't work")
    expect(told[0].body).toContain("Venues don't suit")
    // round 3 (a) and round 4 (b); a's second turn
    expect((await post(none, `${base}/none`, m.a, { reasons: ['dates'], options: options(VENUE, [6, 8, 9], '16:30') })).status).toBe(200)
    expect((await post(none, `${base}/none`, m.b, { reasons: ['dates'], options: options(OTHER_VENUE, [6, 8, 9], '18:00') })).status).toBe(200)
    // a's last answer: turning down the fourth set closes the proposal, the same message to both
    const closed = await j(await post(none, `${base}/none`, m.a, { reasons: ['dates'] }))
    expect(closed.closed).toBe(true)
    for (const who of [m.a, m.b]) {
      expect((await view(m.bookingId, who)).status).toBe('closed')
      const c = await notificationsFor(who.id, 'closed')
      expect(c).toHaveLength(1)
    }
    const [ca, cb] = await Promise.all([notificationsFor(m.a.id, 'closed'), notificationsFor(m.b.id, 'closed')])
    expect(ca[0].body).toBe(cb[0].body)
    expect(ca[0].body).not.toContain(m.a.username)
    expect(ca[0].body).not.toContain(m.b.username)
  })
})

describe('the venue answers', () => {
  it('the venue sees only the reference, the day and the two usernames, then confirms', async () => {
    const r = await requested()
    const partner = await partnerFor(VENUE)
    const list = await j(await get(pRequests, '/api/v1/partner/requests', partner))
    const row = list.requests.find((x: any) => x.id === r.bookingId)
    expect(row).toMatchObject({ ref: expect.stringMatching(/^CM-/), status: 'requested', time: r.picked.time })
    expect(row.guests.map((g: any) => g.username).sort()).toEqual([r.a.username, r.b.username].sort())
    expect(JSON.stringify(row)).not.toMatch(/booking_?code|bookingCode|email|score|@/i)

    expect((await post(pConfirm, `/api/v1/partner/bookings/${r.bookingId}/confirm`, partner)).status).toBe(200)
    expect((await post(pConfirm, `/api/v1/partner/bookings/${r.bookingId}/confirm`, partner)).status).toBe(409)
    for (const who of [r.a, r.b]) {
      const b = await view(r.bookingId, who)
      expect(b.status).toBe('confirmed')
      expect(b.qr).toMatch(/^cm1\./)
      expect(b.bookingCode).toMatch(/^\d{4}$/)
      expect(b.venue.name).toBe('Kaffa Roastery')
      expect(b.venue.offer).toBeTruthy()
      expect(b.actions).toEqual(expect.arrayContaining(['cancel', 'late', 'report']))
      expect(await notificationsFor(who.id, 'confirmed')).toHaveLength(1)
    }
    // each dater has their own code
    expect((await view(r.bookingId, r.a)).qr).not.toBe((await view(r.bookingId, r.b)).qr)
  })

  it('a partner from another venue cannot answer it', async () => {
    const r = await requested()
    const other = await partnerFor(OTHER_VENUE)
    expect((await post(pConfirm, `/api/v1/partner/bookings/${r.bookingId}/confirm`, other)).status).toBe(404)
    expect((await post(pDecline, `/api/v1/partner/bookings/${r.bookingId}/decline`, other)).status).toBe(404)
  })

  it('a decline tells both and starts a fresh round inside the window', async () => {
    const r = await requested()
    const partner = await partnerFor(VENUE)
    expect((await post(pDecline, `/api/v1/partner/bookings/${r.bookingId}/decline`, partner)).status).toBe(200)
    expect((await view(r.bookingId, r.a)).status).toBe('declined')
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'declined')).toHaveLength(1)
    const next = (await j(await get(matchBooking, `/api/v1/matches/${r.matchId}/booking`, r.a))).booking
    expect(next.id).not.toBe(r.bookingId)
    expect(next.status).toBe('proposed')
    // the table is free again
    const slots = (await j(await get(venueSlots, `/api/v1/venues/${VENUE}/slots?date=${r.picked.dateKey}`, r.a))).slots
    expect(slots.find((s: any) => s.time === r.picked.time).available).toBe(true)
  })

  it('a dater can withdraw before the venue answers, and the venue is told', async () => {
    const r = await requested()
    const db = await getDb()
    expect((await post(withdraw, path(r.bookingId, '/withdraw'), r.b)).status).toBe(200)
    expect((await view(r.bookingId, r.a)).status).toBe('cancelled')
    const alerts = (await db.query(`select code from notifications where audience = 'venue' and booking_id = $1 order by created_at`, [r.bookingId])).rows
    expect(alerts.map((x: any) => x.code)).toContain('request_withdrawn')
    expect(await notificationsFor(r.a.id, 'cancelled')).toHaveLength(1)
  })

  it('a requested time holds a table: a full slot cannot be offered or confirmed twice', async () => {
    const db = await getDb()
    await db.query(`update venues set capacity = 1 where id = $1`, [OTHER_VENUE])
    const first = await requested(OTHER_VENUE)
    const second = await matched()
    const clash = await post(sendOptions, path(second.bookingId, '/options'), second.a, { options: [first.picked, ...options(OTHER_VENUE, [8, 9], '18:00').slice(0, 2).map((o, i) => ({ ...o, time: i ? '19:00' : '18:00' }))] })
    expect(clash.status).toBe(409)
    expect((await j(clash)).error.code).toBe('slot_full')
    const slots = (await j(await get(venueSlots, `/api/v1/venues/${OTHER_VENUE}/slots?date=${first.picked.dateKey}`, second.a))).slots
    expect(slots.find((s: any) => s.time === first.picked.time)).toMatchObject({ available: false, reason: 'full' })
    await db.query(`update venues set capacity = 4 where id = $1`, [OTHER_VENUE])
  })

  it('the venue cancelling a confirmed date tells both and offers a rebooking', async () => {
    const r = await confirmed()
    const staff = await partnerFor(VENUE, 'staff')
    expect((await post(pCancel, `/api/v1/partner/bookings/${r.bookingId}/cancel`, staff)).status).toBe(403) // owner only
    expect((await post(pCancel, `/api/v1/partner/bookings/${r.bookingId}/cancel`, r.partner)).status).toBe(200)
    expect((await view(r.bookingId, r.a))).toMatchObject({ status: 'cancelled', cancelledBy: 'venue' })
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'cancelled')).toHaveLength(1)
    const db = await getDb()
    expect((await db.query(`select 1 from notifications where audience = 'admin' and booking_id = $1`, [r.bookingId])).rows.length).toBeGreaterThan(0)
    expect((await j(await get(matchBooking, `/api/v1/matches/${r.matchId}/booking`, r.a))).booking.status).toBe('proposed')
  })
})

describe('the venue is alerted by email and text, only when it has been verified', () => {
  it('sends both once the contact email and the phone are verified', async () => {
    const db = await getDb()
    await db.query(`update venues set contact_email = 'host@kaffa.example', contact_email_verified_at = now(), booking_phone = '+358401234567', booking_phone_verified_at = now() where id = $1`, [VENUE])
    outbox.length = 0
    smsOutbox.length = 0
    const r = await requested()
    const mail = outbox.find((m) => m.to === 'host@kaffa.example')!
    expect(mail.subject).toContain(r.bookingId ? 'New booking request' : '')
    expect(mail.text).toContain('Party of 2')
    expect(mail.text).toContain(r.a.username)
    expect(mail.text).toContain('/requests')
    const text = smsOutbox.find((s) => s.to === '+358401234567')!
    expect(text.text).toMatch(/CM-/)
    expect(text.text).not.toMatch(/@/)
    await db.query(`update venues set contact_email_verified_at = null, booking_phone_verified_at = null where id = $1`, [VENUE])
    outbox.length = 0
    smsOutbox.length = 0
    await requested()
    expect(outbox.some((m) => m.to === 'host@kaffa.example')).toBe(false)
    expect(smsOutbox).toHaveLength(0)
  })
})

describe('on the day', () => {
  it('QR scans check people in; the second scan starts the date; both leave and it ends', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 10)
    const qrA = (await view(r.bookingId, r.a)).qr
    const qrB = (await view(r.bookingId, r.b)).qr

    const first = await j(await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrA }))
    expect(first).toMatchObject({ started: false, username: r.a.username })
    expect((await view(r.bookingId, r.a)).status).toBe('partially_checked_in')
    expect((await notificationsFor(r.a.id, 'checked_in'))[0].body).toContain("hasn't arrived")
    // a code works once
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrA })).status).toBe(409)

    const second = await j(await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrB }))
    expect(second.started).toBe(true)
    expect((await view(r.bookingId, r.b)).status).toBe('in_progress')
    for (const who of [r.a, r.b]) expect((await notificationsFor(who.id, 'started'))[0].title).toContain('Kaffa Roastery')

    // I've left: one tap tells the venue to confirm the end, two end it
    expect((await j(await post(left, path(r.bookingId, '/left'), r.a))).ended).toBe(false)
    const att = await j(await get(pAttention, '/api/v1/partner/attention', r.partner))
    expect(att.mayHaveEnded.map((x: any) => x.id)).toContain(r.bookingId)
    expect((await j(await post(left, path(r.bookingId, '/left'), r.b))).ended).toBe(true)
    expect((await view(r.bookingId, r.a)).status).toBe('ended')
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'rate_your_date')).toHaveLength(1)
    const db = await getDb()
    const events = (await db.query(`select event from booking_events where booking_id = $1 order by id`, [r.bookingId])).rows.map((e: any) => e.event)
    expect(events).toEqual(expect.arrayContaining(['created', 'options_sent', 'option_picked', 'requested', 'venue_confirmed', 'checked_in', 'date_started', 'dater_left', 'ended']))
  })

  it('staff can confirm the date has ended without waiting for the app', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    for (const who of [r.a, r.b]) await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(r.bookingId, who)).qr })
    expect((await post(pEnd, `/api/v1/partner/bookings/${r.bookingId}/end`, r.partner)).status).toBe(200)
    expect((await view(r.bookingId, r.a)).status).toBe('ended')
    expect((await post(pEnd, `/api/v1/partner/bookings/${r.bookingId}/end`, r.partner)).status).toBe(409)
  })

  it('a forged, borrowed or out-of-window code is refused', async () => {
    const r = await confirmed()
    const other = await confirmed(OTHER_VENUE)
    const qrA = (await view(r.bookingId, r.a)).qr
    // too early: the code opens 30 minutes before
    await startsIn(r.bookingId, 120)
    const early = await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrA })
    expect(early.status).toBe(409)
    expect((await j(early)).error.code).toBe('too_early')
    await startsIn(r.bookingId, -45)
    expect((await j(await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrA }))).error.code).toBe('too_late')
    await startsIn(r.bookingId, 0)
    // tampered
    const parts = qrA.split('.')
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: `${parts[0]}.${parts[1]}.AAAA` })).status).toBe(400)
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: 'not a code' })).status).toBe(400)
    // a validly signed code for a booking at another venue is not accepted here
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(other.bookingId, other.a)).qr })).status).toBe(404)
    // a signed token with the wrong one-time number
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: makeQrToken({ b: r.bookingId, u: r.a.id, n: 'stale' }) })).status).toBe(400)
    // the QR itself holds no username
    expect(Buffer.from(parts[1], 'base64url').toString()).not.toContain(r.a.username)
    expect((await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: qrA })).status).toBe(200)
  })

  it('the fallback needs the username and the booking code together', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    const code = (await view(r.bookingId, r.a)).bookingCode
    const go = (body: unknown) => post(pManual, '/api/v1/partner/checkin/manual', r.partner, body)
    expect((await go({ username: r.a.username })).status).toBe(400) // a username alone checks nobody in
    expect((await go({ code })).status).toBe(400)
    expect((await go({ username: r.a.username, code: code === '0000' ? '0001' : '0000' })).status).toBe(404)
    expect((await go({ username: 'Somebody_Else', code })).status).toBe(404)
    const ok = await j(await go({ username: r.a.username.toLowerCase(), code }))
    expect(ok).toMatchObject({ username: r.a.username, started: false })
    expect((await view(r.bookingId, r.a)).me.checkedInAt).toBeTruthy()
    expect((await go({ username: r.a.username, code })).status).toBe(409)
  })

  it('running late is a preset, and a stranger or a bad value is refused', async () => {
    const r = await confirmed()
    expect((await post(late, path(r.bookingId, '/late'), r.a, { minutes: 15 })).status).toBe(200)
    expect((await post(late, path(r.bookingId, '/late'), r.a, { minutes: 7 })).status).toBe(400)
    expect((await post(late, path(r.bookingId, '/late'), r.a, { minutes: 15, note: 'x' })).status).toBe(200)
    expect((await notificationsFor(r.b.id, 'running_late'))[0].body).toContain('15 minutes')
    expect((await view(r.bookingId, r.b)).partnerLateNote).toBe(15)
  })

  it('one dater does not arrive: the waiting dater can mark a no-show after 20 minutes', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(r.bookingId, r.a)).qr })
    // too soon, and only someone who has checked in can do it
    expect((await post(noShow, path(r.bookingId, '/no-show'), r.a)).status).toBe(409)
    expect((await post(noShow, path(r.bookingId, '/no-show'), r.b)).status).toBe(409)
    await startsIn(r.bookingId, -(cfg().noShowGraceMin + 1))
    expect((await post(noShow, path(r.bookingId, '/no-show'), r.b)).status).toBe(409)
    expect((await post(noShow, path(r.bookingId, '/no-show'), r.a)).status).toBe(200)
    const b = await view(r.bookingId, r.a)
    expect(b).toMatchObject({ status: 'no_show', noShowIsMine: false })
    expect((await view(r.bookingId, r.b)).noShowIsMine).toBe(true)
    const db = await getDb()
    expect((await db.query(`select 1 from notifications where audience = 'admin' and booking_id = $1 and code = 'no_show'`, [r.bookingId])).rows).toHaveLength(1)
  })

  it('neither dater arrives: staff mark the no-show', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, -5)
    expect((await post(pNoShow, `/api/v1/partner/bookings/${r.bookingId}/no-show`, r.partner)).status).toBe(409) // grace period
    await startsIn(r.bookingId, -30)
    expect((await post(pNoShow, `/api/v1/partner/bookings/${r.bookingId}/no-show`, r.partner)).status).toBe(200)
    expect((await view(r.bookingId, r.a)).status).toBe('no_show')
  })

  it('cancelling a confirmed date: late (under 24 hours) is recorded for admin, early is not', async () => {
    const early = await confirmed()
    expect((await j(await post(cancel, path(early.bookingId, '/cancel'), early.a))).late).toBe(false)
    expect(await notificationsFor(early.b.id, 'cancelled')).toHaveLength(1)
    const lateOne = await confirmed()
    await startsIn(lateOne.bookingId, 5 * 60)
    expect((await j(await post(cancel, path(lateOne.bookingId, '/cancel'), lateOne.b))).late).toBe(true)
    const db = await getDb()
    expect((await db.query(`select late_cancel from bookings where id = $1`, [lateOne.bookingId])).rows[0].late_cancel).toBe(true)
    expect((await db.query(`select 1 from notifications where audience = 'admin' and code = 'late_cancel' and booking_id = $1`, [lateOne.bookingId])).rows).toHaveLength(1)
    // the venue is told
    expect((await db.query(`select 1 from notifications where audience = 'venue' and code = 'booking_cancelled' and booking_id = $1`, [lateOne.bookingId])).rows).toHaveLength(1)
    // a started date cannot be cancelled
    expect((await post(cancel, path(lateOne.bookingId, '/cancel'), lateOne.a)).status).toBe(409)
  })

  it('unmatching cancels a booking that is waiting and tells the venue if it had been asked', async () => {
    const r = await requested()
    expect((await post(unmatch, `/api/v1/matches/${r.matchId}/unmatch`, r.a)).status).toBe(200)
    const db = await getDb()
    expect((await db.query(`select status from bookings where id = $1`, [r.bookingId])).rows[0].status).toBe('cancelled')
    expect((await db.query(`select 1 from notifications where audience = 'venue' and code = 'booking_cancelled' and booking_id = $1`, [r.bookingId])).rows).toHaveLength(1)
  })
})

describe('after the date', () => {
  async function ended() {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    for (const who of [r.a, r.b]) await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(r.bookingId, who)).qr })
    await post(pEnd, `/api/v1/partner/bookings/${r.bookingId}/end`, r.partner)
    return r
  }
  const body = { dateRating: 4, dateComment: 'Lovely evening', venueRating: 5, venueComment: 'Great coffee' }

  it('feedback is two ratings and optional comments, once each, and comments wait for ChoiceMi', async () => {
    const r = await ended()
    const fb = (who: Who, b: unknown) => post(feedback, path(r.bookingId, '/feedback'), who, b)
    expect((await view(r.bookingId, r.a)).actions).toEqual(expect.arrayContaining(['feedback', 'redate', 'report']))
    expect((await fb(r.a, { ...body, dateRating: 0 })).status).toBe(400)
    expect((await fb(r.a, { ...body, venueRating: 6 })).status).toBe(400)
    expect((await fb(r.a, { ...body, venueComment: 'x'.repeat(501) })).status).toBe(400)
    expect((await fb(r.a, { ...body, stars: 5 })).status).toBe(400)
    expect((await fb(r.a, body)).status).toBe(200)
    expect((await fb(r.a, body)).status).toBe(409)
    expect((await view(r.bookingId, r.a)).feedback.given).toBe(true)
    expect((await view(r.bookingId, r.b)).feedback.given).toBe(false)
    const db = await getDb()
    expect((await db.query(`select comment_status from booking_feedback where booking_id = $1`, [r.bookingId])).rows[0].comment_status).toBe('pending')
    // the window closes after 7 days
    await db.query(`update bookings set ended_at = now() - interval '8 days' where id = $1`, [r.bookingId])
    expect((await fb(r.b, body)).status).toBe(409)
  })

  it('a venue sees its average only after enough ratings, and comments only once approved', async () => {
    const db = await getDb()
    await db.query(`delete from booking_feedback`)
    const partner = await partnerFor(VENUE)
    let r = await ended()
    await post(feedback, path(r.bookingId, '/feedback'), r.a, body)
    const stats = async () => (await j(await get(pStats, '/api/v1/partner/stats', partner))).ratings
    expect(await stats()).toMatchObject({ count: 1, average: null, comments: [] })
    // five ratings on one venue (written straight in for speed)
    for (let i = 0; i < 4; i++) {
      r = await ended()
      await post(feedback, path(r.bookingId, '/feedback'), r.a, { ...body, venueRating: 3, venueComment: 'Too noisy' })
    }
    const s = await stats()
    expect(s.count).toBe(5)
    expect(s.average).toBeCloseTo(3.4, 1)
    expect(s.comments).toEqual([]) // nothing approved yet
    await db.query(`update booking_feedback set comment_status = 'approved' where venue_comment = 'Too noisy'`)
    expect((await stats()).comments.every((c: string) => c === 'Too noisy')).toBe(true)
  })

  it('Redate and Report a concern are separate; a mutual redate opens a fresh booking', async () => {
    const r = await ended()
    expect((await j(await post(redate, path(r.bookingId, '/redate'), r.a))).mutual).toBe(false)
    expect((await view(r.bookingId, r.a)).redate).toEqual({ mine: true, theirs: false })
    expect((await view(r.bookingId, r.b)).redate).toEqual({ mine: false, theirs: true })
    expect((await j(await post(redate, path(r.bookingId, '/redate'), r.b))).mutual).toBe(true)
    const next = (await j(await get(matchBooking, `/api/v1/matches/${r.matchId}/booking`, r.a))).booking
    expect(next).toMatchObject({ status: 'proposed', kind: 'redate' })
    expect(next.id).not.toBe(r.bookingId)
    // reporting is separate, and a low rating is never a report
    expect((await post(report, path(r.bookingId, '/report'), r.a, { category: 'felt_unsafe', details: 'They were pushy' })).status).toBe(200)
    expect((await post(report, path(r.bookingId, '/report'), r.a, { category: 'whatever' })).status).toBe(400)
    const db = await getDb()
    expect((await db.query(`select 1 from booking_reports where booking_id = $1`, [r.bookingId])).rows).toHaveLength(1)
  })

  it('a concern can be raised during the date', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    for (const who of [r.a, r.b]) await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(r.bookingId, who)).qr })
    expect((await view(r.bookingId, r.a)).actions).toContain('report')
    expect((await post(report, path(r.bookingId, '/report'), r.b, { category: 'harassment' })).status).toBe(200)
  })
})

describe('privacy', () => {
  it('what the venue can see of a booking holds no more than the spec allows', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    const rows = (await j(await get(pBookings, `/api/v1/partner/bookings?from=${plusDays(-1)}&to=${plusDays(12)}`, r.partner))).bookings
    const mine = rows.find((x: any) => x.id === r.bookingId)
    expect(mine).toBeTruthy()
    const text = JSON.stringify(mine)
    for (const secret of [r.a.id, r.b.id, 'email', 'phone', 'score', 'qr', 'nonce', 'bookingCode']) expect(text).not.toContain(secret)
    expect(Object.keys(mine.guests[0]).sort()).toEqual(['checkedInAt', 'checkedInVia', 'lateNote', 'leftAt', 'username'])
  })

  it('details drop out of the venue portal 30 days after the date', async () => {
    const r = await confirmed()
    const db = await getDb()
    await db.query(`update bookings set date_on = (now() - interval '40 days')::date, start_at = now() - interval '40 days', status = 'ended' where id = $1`, [r.bookingId])
    const rows = (await j(await get(pBookings, `/api/v1/partner/bookings?from=${plusDays(-60)}&to=${plusDays(-1)}`, r.partner))).bookings
    expect(rows.find((x: any) => x.id === r.bookingId)).toBeUndefined()
  })

  it('a dater only sees their own QR code and nobody else\'s booking', async () => {
    const r = await confirmed()
    const outsider = await matched()
    expect((await get(getBooking, path(r.bookingId), outsider.a)).status).toBe(404)
    expect((await post(cancel, path(r.bookingId, '/cancel'), outsider.a)).status).toBe(404)
    expect((await view(r.bookingId, r.a)).qr).not.toBe((await view(r.bookingId, r.b)).qr)
    expect((await get(notifications, '/api/v1/notifications', r.a)).status).toBe(200)
  })
})

describe('the clock', () => {
  const runTick = async () => j(await tick(req('/api/v1/admin/tick', { method: 'POST', headers: { 'x-tick-secret': TICK }, body: {} })))

  it('only the cron secret can run it', async () => {
    expect((await tick(req('/api/v1/admin/tick', { method: 'POST', body: {} }))).status).toBe(401)
    expect((await tick(req('/api/v1/admin/tick', { method: 'POST', headers: { 'x-tick-secret': 'nope' }, body: {} }))).status).toBe(401)
  })

  it('reminds once when nobody sent options, and closes quietly when the window passes', async () => {
    const m = await matched()
    const db = await getDb()
    await db.query(`update bookings set deadline_at = now() - interval '1 hour' where id = $1`, [m.bookingId])
    const first = await runTick()
    expect(first.reminded).toBeGreaterThanOrEqual(1)
    for (const who of [m.a, m.b]) expect(await notificationsFor(who.id, 'options_reminder')).toHaveLength(1)
    await runTick()
    expect(await notificationsFor(m.a.id, 'options_reminder')).toHaveLength(1) // only once
    await db.query(`update bookings set window_end = (now() - interval '2 days')::date where id = $1`, [m.bookingId])
    await runTick()
    expect((await view(m.bookingId, m.a)).status).toBe('closed')
    expect((await notificationsFor(m.b.id, 'closed'))).toHaveLength(1)
  })

  it('unanswered options and unconfirmed picks expire, both are told, and a new round begins', async () => {
    const m = await matched()
    const db = await getDb()
    await post(sendOptions, path(m.bookingId, '/options'), m.a, { options: options(VENUE) })
    await db.query(`update bookings set deadline_at = now() - interval '1 minute' where id = $1`, [m.bookingId])
    expect((await post(pick, path(m.bookingId, '/pick'), m.b, { optionId: (await view(m.bookingId, m.b)).options[0].id })).status).toBe(409)
    await runTick()
    expect((await view(m.bookingId, m.a)).status).toBe('expired')
    for (const who of [m.a, m.b]) expect(await notificationsFor(who.id, 'expired')).toHaveLength(1)
    const next = (await j(await get(matchBooking, `/api/v1/matches/${m.matchId}/booking`, m.a))).booking
    expect(next.id).not.toBe(m.bookingId)
    expect(next.status).toBe('proposed')
    // nothing ever reached the venue
    expect((await db.query(`select 1 from notifications where audience = 'venue' and booking_id = $1`, [m.bookingId])).rows).toHaveLength(0)
  })

  it('a venue that misses its deadline is treated like a decline, and repeated misses reach admin', async () => {
    const db = await getDb()
    const a = await requested()
    const b = await requested()
    await db.query(`update bookings set venue_deadline_at = now() - interval '1 minute' where id = any($1::uuid[])`, [[a.bookingId, b.bookingId]])
    await runTick()
    for (const r of [a, b]) {
      expect((await view(r.bookingId, r.a)).status).toBe('expired')
      expect(await notificationsFor(r.a.id, 'venue_no_answer')).toHaveLength(1)
    }
    expect((await db.query(`select 1 from notifications where audience = 'admin' and code = 'venue_misses'`)).rows.length).toBeGreaterThan(0)
  })

  it('sends the day-before and two-hours-before notices once, and the venue sees the day-before in its portal', async () => {
    const r = await confirmed()
    await startsIn(r.bookingId, 20 * 60)
    await runTick()
    await runTick()
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'day_before')).toHaveLength(1)
    const db = await getDb()
    expect((await db.query(`select 1 from notifications where audience = 'venue' and code = 'day_before' and booking_id = $1`, [r.bookingId])).rows).toHaveLength(1)
    await startsIn(r.bookingId, 90)
    await runTick()
    await runTick()
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'two_hours')).toHaveLength(1)
  })

  it('auto-closes a date nobody confirmed ended, reminds about ratings once, and records forgotten no-shows', async () => {
    const db = await getDb()
    const r = await confirmed()
    await startsIn(r.bookingId, 5)
    for (const who of [r.a, r.b]) await post(pScan, '/api/v1/partner/checkin/scan', r.partner, { token: (await view(r.bookingId, who)).qr })
    await db.query(`update bookings set started_at = now() - interval '9 hours', date_on = (now() - interval '1 day')::date where id = $1`, [r.bookingId])
    await runTick()
    expect((await view(r.bookingId, r.a)).status).toBe('ended')
    await db.query(`update bookings set ended_at = now() - interval '30 hours' where id = $1`, [r.bookingId])
    await runTick()
    await runTick()
    for (const who of [r.a, r.b]) expect(await notificationsFor(who.id, 'rate_reminder')).toHaveLength(1)

    const forgotten = await confirmed()
    await startsIn(forgotten.bookingId, -25 * 60)
    await runTick()
    expect((await view(forgotten.bookingId, forgotten.a)).status).toBe('no_show')
  })
})
