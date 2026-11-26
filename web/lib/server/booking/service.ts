import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import type { PublicUser } from '../auth/service'
import { rateLimit } from '../auth/rateLimit'
import { assertCanBrowse } from '../compat/discover'
import { assertBookable, loadRules } from '../social/availability'
import { BOOKING_SLOTS } from '@/lib/booking'
import { NONE_REASONS, NONE_REASON_TEXT, STATUS_LIVE, cfg, type BookingStatus, type NoneReason } from './config'
import { logBookingEvent, setStatus } from './events'
import { openTicket } from '../support/service'
import { Outbox, dayText, memberLink, notifyAdmin, notifyDater, notifyVenue, whenText } from './notify'
import { makeQrToken, newBookingCode, newNonce, newRef } from './qr'
import { UUID, addDays, hoursFromNow, normaliseDateKey, startInstant, todayHelsinki } from './util'

/**
 * The daters' side of a booking, following the partner spec:
 *   proposed → picked → requested → confirmed → partially_checked_in → in_progress → ended
 * with declined, expired, closed, cancelled and no_show as the other ways out. The venue's side (confirming,
 * scanning, ending) is in lib/server/partner/bookings.ts; the clock-driven steps are in sweeps.ts.
 */

export const COLS = `b.id, b.ref, b.match_id, b.user_a, b.user_b, b.kind, b.status,
  to_char(b.window_start, 'YYYY-MM-DD') as window_start, to_char(b.window_end, 'YYYY-MM-DD') as window_end,
  b.first_sender, b.turn_user, b.rounds, b.deadline_at, b.reminded_at, b.picked_option_id, b.sender_id, b.venue_id,
  to_char(b.date_on, 'YYYY-MM-DD') as date_on, b.start_time, b.start_at, b.requested_at, b.venue_deadline_at, b.confirmed_at,
  b.booking_code, b.offer_claimed_at, b.started_at, b.ended_at, b.ended_by, b.cancelled_at, b.cancelled_by, b.cancelled_role, b.late_cancel,
  b.no_show_at, b.no_show_by, b.no_show_user, b.closed_reason, b.is_test, b.created_at`

export interface BookingRow {
  id: string
  ref: string
  match_id: string
  user_a: string
  user_b: string
  kind: 'first' | 'redate'
  status: BookingStatus
  window_start: string
  window_end: string
  first_sender: string | null
  turn_user: string | null
  rounds: number
  deadline_at: Date | null
  reminded_at: Date | null
  picked_option_id: string | null
  sender_id: string | null
  venue_id: string | null
  date_on: string | null
  start_time: string | null
  start_at: Date | null
  requested_at: Date | null
  venue_deadline_at: Date | null
  confirmed_at: Date | null
  booking_code: string | null
  offer_claimed_at: Date | null
  started_at: Date | null
  ended_at: Date | null
  ended_by: 'both_left' | 'staff' | 'auto' | null
  cancelled_at: Date | null
  cancelled_by: string | null
  cancelled_role: 'dater' | 'venue' | 'system' | null
  late_cancel: boolean
  no_show_at: Date | null
  no_show_by: 'dater' | 'venue' | null
  no_show_user: string | null
  closed_reason: string | null
  is_test: boolean
  created_at: Date
}

export const other = (b: { user_a: string; user_b: string }, me: string) => (b.user_a === me ? b.user_b : b.user_a)

export async function loadBooking(q: Queryable, id: string, lock = false): Promise<BookingRow> {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such booking.')
  const { rows } = await q.query<BookingRow>(`select ${COLS} from bookings b where b.id = $1 ${lock ? 'for update' : ''}`, [id])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such booking.')
  return rows[0]
}

/** A booking the viewer is one of the two people in. Anyone else gets "not found". */
export async function loadMine(q: Queryable, viewer: PublicUser, id: string, lock = false): Promise<BookingRow> {
  const b = await loadBooking(q, id, lock)
  if (b.user_a !== viewer.id && b.user_b !== viewer.id) throw new ApiError(404, 'not_found', 'No such booking.')
  return b
}

const usernameOf = async (q: Queryable, id: string) => (await q.query<{ username: string }>('select username from users where id = $1', [id])).rows[0]?.username ?? 'Your date'

interface VenueLite {
  id: string
  name: string
  area: string
  address: string
}
export async function venueLite(q: Queryable, id: string): Promise<VenueLite> {
  const r = (await q.query<VenueLite>('select id, name, area, coalesce(nullif(formatted_address, \'\'), address) as address from venues where id = $1', [id])).rows[0]
  if (!r) throw new ApiError(404, 'not_found', 'No such venue.')
  return r
}

/* ----------------------------------------------------------------- creating */

async function freshRef(q: Queryable): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const ref = newRef()
    if (!(await q.query('select 1 from bookings where ref = $1', [ref])).rows.length) return ref
  }
  throw new ApiError(500, 'internal', 'Could not make a booking reference.')
}

/**
 * Starts planning for a match: the date window opens on day 5 and closes on day 10 after the match (config).
 * A redate has its own, wider window. Both daters are told (notification 1).
 */
export async function createBooking(q: Queryable, matchId: string, opts: { kind?: 'first' | 'redate'; windowStart?: string; windowEnd?: string } = {}): Promise<BookingRow> {
  const m = (await q.query<{ user_a: string; user_b: string }>('select user_a, user_b from matches where id = $1', [matchId])).rows[0]
  if (!m) throw new ApiError(404, 'not_found', 'No such match.')
  const kind = opts.kind ?? 'first'
  const today = await todayHelsinki(q)
  const c = cfg()
  const windowStart = opts.windowStart ?? (kind === 'first' ? addDays(today, c.windowFromDay) : addDays(today, 2))
  const windowEnd = opts.windowEnd ?? (kind === 'first' ? addDays(today, c.windowToDay) : addDays(today, 30))
  const ref = await freshRef(q)
  const { rows } = await q.query<{ id: string }>(
    `insert into bookings (ref, match_id, user_a, user_b, kind, window_start, window_end, deadline_at)
     values ($1, $2, $3, $4, $5, $6::date, $7::date, $8) returning id`,
    [ref, matchId, m.user_a, m.user_b, kind, windowStart, windowEnd, hoursFromNow(c.firstOptionsHours)],
  )
  const id = rows[0].id
  await logBookingEvent(q, id, 'created', { actor: 'system', to: 'proposed', meta: { kind, windowStart, windowEnd } })
  for (const uid of [m.user_a, m.user_b]) {
    await notifyDater(q, {
      userId: uid,
      bookingId: id,
      no: 1,
      code: 'match_window',
      title: 'Plan your first date',
      body: `Your date window is ${dayText(windowStart)} to ${dayText(windowEnd)}. Send 3 options within ${c.firstOptionsHours} hours.`,
    })
  }
  return loadBooking(q, id)
}

/** After a lapsed or declined booking: another round of planning on the same match, inside what is left of the window. */
export async function rebook(q: Queryable, old: BookingRow): Promise<BookingRow | null> {
  const live = await q.query(`select 1 from bookings where match_id = $1 and status = any($2::text[])`, [old.match_id, [...STATUS_LIVE]])
  if (live.rows.length) return null
  const today = await todayHelsinki(q)
  let from = addDays(today, 2)
  if (from < old.window_start) from = old.window_start
  const to = old.window_end >= from ? old.window_end : addDays(today, 7)
  return createBooking(q, old.match_id, { kind: old.kind, windowStart: from, windowEnd: to })
}

/* ------------------------------------------------------------------- options */

export interface OptionInput {
  venueId: string
  dateKey: string
  time: string
}

interface ParsedOption {
  venueId: string
  dateOn: string
  time: string
  startAt: Date
}

const key = (o: { venueId: string; dateOn: string; time: string }) => `${o.venueId}|${o.dateOn}|${o.time}`

export function parseOptionInputs(body: unknown): OptionInput[] {
  const list = Array.isArray(body) ? body : []
  if (list.length !== cfg().optionsPerSet) throw new ApiError(400, 'invalid_options', `Send exactly ${cfg().optionsPerSet} options.`)
  return list.map((o) => {
    const x = (o ?? {}) as Record<string, unknown>
    const extra = Object.keys(x).filter((k) => !['venueId', 'dateKey', 'time'].includes(k))
    if (extra.length) throw new ApiError(400, 'invalid_options', 'An option is a venue, a day and a time, nothing else.')
    if (typeof x.venueId !== 'string' || typeof x.dateKey !== 'string' || typeof x.time !== 'string') throw new ApiError(400, 'invalid_options', 'Each option needs a venue, a day and a time.')
    return { venueId: x.venueId, dateKey: x.dateKey, time: x.time }
  })
}

async function validateOptions(q: Queryable, b: BookingRow, inputs: OptionInput[]): Promise<ParsedOption[]> {
  const today = await todayHelsinki(q)
  const earlier = (await q.query<{ venue_id: string; date_on: string; start_time: string }>(`select venue_id, to_char(date_on, 'YYYY-MM-DD') as date_on, start_time from booking_options where booking_id = $1`, [b.id])).rows
  const used = new Set(earlier.map((o) => key({ venueId: o.venue_id, dateOn: o.date_on, time: o.start_time })))
  const seen = new Set<string>()
  const out: ParsedOption[] = []
  const earliest = b.kind === 'first' ? b.window_start : addDays(today, 1) > b.window_start ? addDays(today, 1) : b.window_start
  for (const i of inputs) {
    const dateOn = normaliseDateKey(i.dateKey)
    if (!dateOn) throw new ApiError(400, 'invalid_date', 'Choose a real date for every option.')
    if (!(BOOKING_SLOTS as readonly string[]).includes(i.time)) throw new ApiError(400, 'invalid_time', 'Dates start between 12:00 and 19:00, at the offered times.')
    if (dateOn < earliest || dateOn > b.window_end) throw new ApiError(400, 'outside_window', `Every option must fall between ${dayText(earliest)} and ${dayText(b.window_end)}.`)
    const k = key({ venueId: i.venueId, dateOn, time: i.time })
    if (seen.has(k)) throw new ApiError(400, 'duplicate_option', 'The three options must be different.')
    if (used.has(k)) throw new ApiError(400, 'already_offered', 'An option that was already offered cannot be sent again.')
    seen.add(k)
    const startAt = await startInstant(q, dateOn, i.time)
    if (startAt.getTime() < Date.now() + cfg().venueNoticeHours * 3_600_000) throw new ApiError(400, 'too_soon', `The venue needs at least ${cfg().venueNoticeHours} hours notice.`)
    const rules = await loadRules(q, i.venueId)
    if (!rules || rules.status !== 'active') throw new ApiError(404, 'not_found', 'One of those venues is not taking dates.')
    await assertBookable(q, rules, dateOn, i.time)
    out.push({ venueId: i.venueId, dateOn, time: i.time, startAt })
  }
  return out
}

async function insertOptions(q: Queryable, b: BookingRow, round: number, by: string, opts: ParsedOption[]): Promise<void> {
  for (const o of opts) {
    await q.query(
      `insert into booking_options (booking_id, round, sent_by, venue_id, date_on, start_time, start_at) values ($1, $2, $3, $4, $5::date, $6, $7)`,
      [b.id, round, by, o.venueId, o.dateOn, o.time, o.startAt],
    )
  }
  await q.query('update booking_options set status = $2 where booking_id = $1 and round < $3 and status = $4', [b.id, 'turned_down', round, 'offered'])
}

const maxRounds = () => cfg().turnsEach * 2

/** Whoever goes first sends the first three options. Nothing reaches the venue yet. */
export async function sendFirstOptions(viewer: PublicUser, id: string, inputs: OptionInput[]): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  await rateLimit('booking-options', viewer.id, 60, 3600)
  const db = await getDb()
  const out = new Outbox()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'proposed' || b.rounds !== 0) throw new ApiError(409, 'not_open', 'Options have already been sent for this date.')
    const opts = await validateOptions(q, b, inputs)
    await insertOptions(q, b, 1, viewer.id, opts)
    const c = cfg()
    await q.query(`update bookings set rounds = 1, first_sender = $2, turn_user = $3, deadline_at = $4, updated_at = now() where id = $1`, [b.id, viewer.id, other(b, viewer.id), hoursFromNow(c.answerHours)])
    await q.query(`insert into booking_turns (booking_id, round, actor, action) values ($1, 1, $2, 'sent')`, [b.id, viewer.id])
    await logBookingEvent(q, b.id, 'options_sent', { actor: 'dater', actorId: viewer.id, from: 'proposed', to: 'proposed', meta: { round: 1 } })
    await notifyDater(q, { userId: other(b, viewer.id), bookingId: b.id, no: 3, code: 'options_proposed', title: 'You have date options to choose from', body: `${viewer.username} sent you 3 options. Pick the one that suits you, or choose None of these.` })
  })
  await out.flush()
  return { ok: true }
}

function ensureTurn(b: BookingRow, viewer: PublicUser) {
  if (b.status !== 'proposed' || b.rounds === 0) throw new ApiError(409, 'not_open', 'There are no options waiting for you.')
  if (b.turn_user !== viewer.id) throw new ApiError(409, 'not_your_turn', 'It is not your turn.')
  if (b.deadline_at && new Date(b.deadline_at).getTime() < Date.now()) throw new ApiError(409, 'expired', 'These options have expired.')
}

/** The other dater picks one of the options. The dater who sent it must then confirm. */
export async function pickOption(viewer: PublicUser, id: string, optionId: unknown): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  if (typeof optionId !== 'string' || !UUID.test(optionId)) throw new ApiError(400, 'invalid_request', 'Choose one of the options.')
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    ensureTurn(b, viewer)
    const o = (
      await q.query<{ id: string; sent_by: string; venue_id: string; date_on: string; start_time: string; start_at: Date }>(
        `select id, sent_by, venue_id, to_char(date_on, 'YYYY-MM-DD') as date_on, start_time, start_at from booking_options where id = $1 and booking_id = $2 and round = $3 and status = 'offered'`,
        [optionId, b.id, b.rounds],
      )
    ).rows[0]
    if (!o) throw new ApiError(404, 'not_found', 'That option is not on offer.')
    const c = cfg()
    if (new Date(o.start_at).getTime() < Date.now() + c.venueNoticeHours * 3_600_000) {
      await q.query(`update booking_options set status = 'expired' where id = $1`, [o.id])
      throw new ApiError(409, 'option_expired', 'That option is too close to its date to book. Pick another.')
    }
    await q.query(`update booking_options set status = 'picked' where id = $1`, [o.id])
    await q.query(`insert into booking_turns (booking_id, round, actor, action) values ($1, $2, $3, 'picked')`, [b.id, b.rounds, viewer.id])
    await setStatus(q, b, 'picked', 'option_picked', { type: 'dater', id: viewer.id }, { optionId: o.id }, {
      picked_option_id: o.id,
      sender_id: o.sent_by,
      venue_id: o.venue_id,
      date_on: o.date_on,
      start_time: o.start_time,
      start_at: o.start_at,
      turn_user: o.sent_by,
      deadline_at: hoursFromNow(c.confirmHours),
    })
    await notifyDater(q, { userId: o.sent_by, bookingId: b.id, no: 5, code: 'option_picked', title: 'An option was picked', body: `${viewer.username} picked an option. Confirm to book it within ${c.confirmHours} hours.` })
  })
  return { ok: true }
}

/**
 * "None of these": at least one preset reason, then three new options back (the roles swap). Each dater has two
 * turns; if the last set is also turned down, the proposal closes with the same neutral message to both.
 */
export async function noneOfThese(viewer: PublicUser, id: string, body: { reasons?: unknown; options?: unknown }): Promise<{ ok: true; closed: boolean }> {
  assertCanBrowse(viewer)
  await rateLimit('booking-options', viewer.id, 60, 3600)
  const reasons = Array.isArray(body.reasons) ? [...new Set(body.reasons.filter((r): r is NoneReason => (NONE_REASONS as readonly string[]).includes(r as string)))] : []
  if (reasons.length === 0) throw new ApiError(400, 'reason_required', 'Pick at least one reason: dates, times or venues.')
  const db = await getDb()
  let closed = false
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    ensureTurn(b, viewer)
    await q.query(`insert into booking_turns (booking_id, round, actor, action, reasons) values ($1, $2, $3, 'none', $4::text[])`, [b.id, b.rounds, viewer.id, reasons])
    await q.query(`update booking_options set status = 'turned_down' where booking_id = $1 and round = $2 and status = 'offered'`, [b.id, b.rounds])
    const sender = other(b, viewer.id)
    if (b.rounds >= maxRounds()) {
      closed = true
      await closeBooking(q, b, 'rounds_used', viewer.id)
      return
    }
    const inputs = parseOptionInputs(body.options)
    const opts = await validateOptions(q, b, inputs)
    const round = b.rounds + 1
    await insertOptions(q, b, round, viewer.id, opts)
    await q.query(`update bookings set rounds = $2, turn_user = $3, deadline_at = $4, updated_at = now() where id = $1`, [b.id, round, sender, hoursFromNow(cfg().answerHours)])
    await q.query(`insert into booking_turns (booking_id, round, actor, action) values ($1, $2, $3, 'sent')`, [b.id, round, viewer.id])
    await logBookingEvent(q, b.id, 'none_of_these', { actor: 'dater', actorId: viewer.id, from: 'proposed', to: 'proposed', meta: { round, reasons } })
    await notifyDater(q, {
      userId: sender,
      bookingId: b.id,
      no: 4,
      code: 'none_of_these',
      title: 'None of those suited them',
      body: `None of those suited ${viewer.username}: ${reasons.map((r) => NONE_REASON_TEXT[r]).join(', ')}. Here are 3 new options.`,
    })
  })
  return { ok: true, closed }
}

/** Every round turned down, or the window passed: both daters get the same neutral message, never who stalled it. */
export async function closeBooking(q: Queryable, b: BookingRow, reason: string, actorId?: string | null): Promise<void> {
  await setStatus(q, b, 'closed', 'closed', actorId ? { type: 'dater', id: actorId } : { type: 'system' }, { reason }, { closed_reason: reason, turn_user: null, deadline_at: null })
  for (const uid of [b.user_a, b.user_b]) {
    await notifyDater(q, { userId: uid, bookingId: b.id, no: 7, code: 'closed', title: 'No date found this time', body: 'You could not settle on a date inside your window. The window has closed.' })
  }
}

/* ------------------------------------------------------------ the venue request */

/** The sender confirms the picked option: only now does the booking go to the venue. */
export async function confirmPicked(viewer: PublicUser, id: string): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const out = new Outbox()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'picked') throw new ApiError(409, 'not_open', 'There is nothing to confirm.')
    if (b.sender_id !== viewer.id) throw new ApiError(403, 'not_sender', 'The person who sent that option confirms it.')
    if (b.deadline_at && new Date(b.deadline_at).getTime() < Date.now()) throw new ApiError(409, 'expired', 'This took too long and has expired.')
    const c = cfg()
    if (!b.start_at || !b.venue_id || !b.date_on || !b.start_time) throw new ApiError(409, 'not_open', 'There is nothing to confirm.')
    if (new Date(b.start_at).getTime() < Date.now() + c.venueNoticeHours * 3_600_000) {
      await q.query(`update booking_options set status = 'expired' where id = $1`, [b.picked_option_id])
      await setStatus(q, b, 'expired', 'too_close_to_confirm', { type: 'system' }, {}, { deadline_at: null, turn_user: null })
      for (const uid of [b.user_a, b.user_b]) await notifyDater(q, { userId: uid, bookingId: b.id, no: 6, code: 'expired', title: 'These date options have expired', body: 'The date is now too close for the venue to be told in time. You can plan another one.' })
      await rebook(q, b)
      return
    }
    const rules = await loadRules(q, b.venue_id, true)
    if (!rules || rules.status !== 'active') throw new ApiError(409, 'venue_unavailable', 'That venue is not taking dates right now.')
    await assertBookable(q, rules, b.date_on, b.start_time, b.id)
    const deadline = hoursFromNow(c.venueResponseHours)
    await setStatus(q, b, 'requested', 'requested', { type: 'dater', id: viewer.id }, {}, { requested_at: new Date(), venue_deadline_at: deadline, deadline_at: null, turn_user: null })
    const venue = await venueLite(q, b.venue_id)
    const names = `${await usernameOf(q, b.user_a)} and ${await usernameOf(q, b.user_b)}`
    const when = `${dayText(b.date_on)} at ${b.start_time}`
    await notifyVenue(q, out, {
      venueId: b.venue_id,
      bookingId: b.id,
      no: 8,
      code: 'booking_request',
      title: `New booking request ${b.ref}`,
      body: `Reference: ${b.ref}\nDate: ${when}\nParty of 2: ${names}\n\nConfirm or decline in the portal within ${c.venueResponseHours} hours.`,
      email: true,
      sms: true,
      cta: { label: 'Open the request', path: '/requests' },
      smsText: `ChoiceMi booking request ${b.ref}: ${when}, party of 2, ${names.replace(' and ', ' & ')}. Answer in the portal.`,
    })
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 9, code: 'request_sent', title: `Request sent to ${venue.name}`, body: "We'll tell you when it's confirmed." })
    }
  })
  await out.flush()
  return { ok: true }
}

/** A dater withdraws before the venue answers: the venue's alert is retracted. */
export async function withdrawRequest(viewer: PublicUser, id: string): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const out = new Outbox()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'requested') throw new ApiError(409, 'not_open', 'This request can no longer be withdrawn.')
    await setStatus(q, b, 'cancelled', 'withdrawn', { type: 'dater', id: viewer.id }, {}, { cancelled_at: new Date(), cancelled_by: viewer.id, cancelled_role: 'dater' })
    await notifyVenue(q, out, {
      venueId: b.venue_id!,
      bookingId: b.id,
      no: 19,
      code: 'request_withdrawn',
      title: `Request ${b.ref} withdrawn`,
      body: `The guests withdrew request ${b.ref} for ${whenText(b.date_on!, b.start_time!)}. You do not need to answer it.`,
      email: true,
      sms: true,
      smsText: `ChoiceMi: booking request ${b.ref} was withdrawn. No answer needed.`,
    })
    await notifyDater(q, { userId: other(b, viewer.id), bookingId: b.id, no: 19, code: 'cancelled', title: 'The request was withdrawn', body: `${viewer.username} withdrew the request before the venue answered.` })
  })
  await out.flush()
  return { ok: true }
}

/* --------------------------------------------------------------- after confirm */

/** Either dater cancels after the venue confirmed. Late cancellations (under 24 h) count on the dater's record. */
export async function cancelConfirmed(viewer: PublicUser, id: string): Promise<{ ok: true; late: boolean }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const out = new Outbox()
  let late = false
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'confirmed') throw new ApiError(409, 'not_open', 'Only a confirmed date can be cancelled.')
    late = !!b.start_at && new Date(b.start_at).getTime() - Date.now() < cfg().lateCancelHours * 3_600_000
    await setStatus(q, b, 'cancelled', 'cancelled_by_dater', { type: 'dater', id: viewer.id }, { late }, { cancelled_at: new Date(), cancelled_by: viewer.id, cancelled_role: 'dater', late_cancel: late })
    await notifyDater(q, { userId: other(b, viewer.id), bookingId: b.id, no: 19, code: 'cancelled', title: 'Your date was cancelled', body: `${viewer.username} cancelled your date on ${whenText(b.date_on!, b.start_time!)}.` })
    await notifyVenue(q, out, {
      venueId: b.venue_id!,
      bookingId: b.id,
      no: 19,
      code: 'booking_cancelled',
      title: `Booking ${b.ref} was cancelled`,
      body: `A guest cancelled booking ${b.ref} for ${whenText(b.date_on!, b.start_time!)}. The table is free again.`,
      email: true,
      sms: true,
      smsText: `ChoiceMi: booking ${b.ref} (${whenText(b.date_on!, b.start_time!)}) was cancelled. The table is free again.`,
    })
    if (late) await notifyAdmin(q, { bookingId: b.id, no: 19, code: 'late_cancel', title: 'Late cancellation', body: `${viewer.username} cancelled ${b.ref} less than ${cfg().lateCancelHours} hours before the date.` })
  })
  await out.flush()
  return { ok: true, late }
}

/** A running-late preset: it tells the other dater and the venue. Presets only, no free text. */
export async function runningLate(viewer: PublicUser, id: string, minutes: unknown): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  if (minutes !== 10 && minutes !== 15) throw new ApiError(400, 'invalid_request', 'Choose about 10 or about 15 minutes.')
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'confirmed' && b.status !== 'partially_checked_in') throw new ApiError(409, 'not_open', 'You can only say you are late for a confirmed date.')
    await q.query('update booking_guests set late_note = $3 where booking_id = $1 and user_id = $2', [b.id, viewer.id, minutes])
    await logBookingEvent(q, b.id, 'running_late', { actor: 'dater', actorId: viewer.id, meta: { minutes } })
    await notifyDater(q, { userId: other(b, viewer.id), bookingId: b.id, no: 14, code: 'running_late', title: 'Your date is running late', body: `${viewer.username} is running about ${minutes} minutes late.` })
    await q.query(
      `insert into notifications (audience, venue_id, booking_id, event_no, code, title, body, channels) values ('venue', $1, $2, 14, 'running_late', $3, $4, '{portal}')`,
      [b.venue_id, b.id, `${b.ref}: a guest is running late`, `${viewer.username} is running about ${minutes} minutes late for ${b.start_time}.`],
    )
  })
  return { ok: true }
}

/** "I've left": the venue is asked to confirm the date ended; if both have left, it ends here. */
export async function leave(viewer: PublicUser, id: string): Promise<{ ok: true; ended: boolean }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  let ended = false
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'in_progress') throw new ApiError(409, 'not_open', 'Your date has not started.')
    await q.query('update booking_guests set left_at = coalesce(left_at, now()) where booking_id = $1 and user_id = $2', [b.id, viewer.id])
    await logBookingEvent(q, b.id, 'dater_left', { actor: 'dater', actorId: viewer.id })
    const left = (await q.query<{ n: number }>('select count(*)::int as n from booking_guests where booking_id = $1 and left_at is not null', [b.id])).rows[0].n
    if (left >= 2) {
      ended = true
      await endBooking(q, b, 'both_left', { type: 'dater', id: viewer.id })
    } else {
      await q.query(
        `insert into notifications (audience, venue_id, booking_id, event_no, code, title, body, channels) values ('venue', $1, $2, 16, 'guest_left', $3, $4, '{portal}')`,
        [b.venue_id, b.id, `${b.ref}: a guest has left`, `${viewer.username} tapped I have left. Please confirm this date has ended.`],
      )
    }
  })
  return { ok: true, ended }
}

/** The date is over: both daters are asked to rate it (notification 17). */
export async function endBooking(q: Queryable, b: BookingRow, by: 'both_left' | 'staff' | 'auto', actor: { type: 'dater' | 'venue' | 'system' | 'admin'; id?: string | null }): Promise<void> {
  await setStatus(q, b, 'ended', 'ended', actor, { by }, { ended_at: new Date(), ended_by: by })
  if (b.is_test) {
    // the venue's practice run is complete: it can now go live
    await q.query('update venues set test_done_at = coalesce(test_done_at, now()) where id = $1', [b.venue_id])
    return
  }
  for (const uid of [b.user_a, b.user_b]) {
    await notifyDater(q, { userId: uid, bookingId: b.id, no: 17, code: 'rate_your_date', title: 'How was your date?', body: 'Rate your date and the venue.' })
  }
}

/** The waiting dater marks a no-show after the grace period and may leave without penalty. */
export async function markNoShowByDater(viewer: PublicUser, id: string): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const out = new Outbox()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'partially_checked_in') throw new ApiError(409, 'not_open', 'You can mark a no-show once you are checked in and your date is not.')
    const me = (await q.query<{ checked_in_at: Date | null }>('select checked_in_at from booking_guests where booking_id = $1 and user_id = $2', [b.id, viewer.id])).rows[0]
    if (!me?.checked_in_at) throw new ApiError(409, 'not_checked_in', 'Check in first.')
    const grace = cfg().noShowGraceMin
    if (!b.start_at || Date.now() < new Date(b.start_at).getTime() + grace * 60_000) throw new ApiError(409, 'too_early', `Wait ${grace} minutes past the start time before marking a no-show.`)
    const absent = other(b, viewer.id)
    await setStatus(q, b, 'no_show', 'no_show_by_dater', { type: 'dater', id: viewer.id }, { absent }, { no_show_at: new Date(), no_show_by: 'dater', no_show_user: absent })
    await notifyDater(q, { userId: viewer.id, bookingId: b.id, no: 20, code: 'no_show', title: 'No-show recorded', body: 'Your date did not arrive. You are free to leave, and there is no penalty for you.' })
    await notifyAdmin(q, { bookingId: b.id, no: 20, code: 'no_show', title: 'No-show', body: `${await usernameOf(q, absent)} did not arrive for ${b.ref}. Marked by the waiting dater.` })
    await q.query(
      `insert into notifications (audience, venue_id, booking_id, event_no, code, title, body, channels) values ('venue', $1, $2, 20, 'no_show', $3, $4, '{portal}')`,
      [b.venue_id, b.id, `${b.ref}: no-show`, 'One guest did not arrive. The waiting guest left.'],
    )
  })
  await out.flush()
  return { ok: true }
}

/* ------------------------------------------------------------- feedback etc. */

const REPORT_CATEGORIES = ['felt_unsafe', 'harassment', 'inappropriate_behaviour', 'not_as_described', 'other'] as const

/** A concern raised during or after a date, reachable throughout. A low rating is never treated as a report. */
export async function reportConcern(viewer: PublicUser, id: string, body: { category?: unknown; details?: unknown }): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  await rateLimit('booking-report', viewer.id, 20, 3600)
  const category = typeof body.category === 'string' && (REPORT_CATEGORIES as readonly string[]).includes(body.category) ? body.category : null
  if (!category) throw new ApiError(400, 'invalid_request', 'Choose what happened.')
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 500) : ''
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id)
    if (!['confirmed', 'partially_checked_in', 'in_progress', 'ended', 'no_show'].includes(b.status)) throw new ApiError(409, 'not_open', 'You can report a concern once a date is booked.')
    await q.query('insert into booking_reports (booking_id, reporter, category, details) values ($1, $2, $3, $4)', [b.id, viewer.id, category, details])
    await logBookingEvent(q, b.id, 'concern_reported', { actor: 'dater', actorId: viewer.id, meta: { category } })
    await openTicket(q, {
      requesterId: viewer.id,
      kind: 'member',
      bookingId: b.id,
      category: 'safety',
      priority: 'urgent',
      subject: `Concern reported on ${b.ref}`,
      body: `${category.replace(/_/g, ' ')}${details ? `: ${details}` : ''}`,
      source: 'report',
    })
    await notifyAdmin(q, { bookingId: b.id, no: 0, code: 'report', title: `Concern reported on ${b.ref}`, body: `${viewer.username} reported: ${category.replace(/_/g, ' ')}.` })
  })
  return { ok: true }
}

export interface FeedbackInput {
  dateRating: number
  dateComment: string
  venueRating: number
  venueComment: string
}

export function validateFeedback(body: Record<string, unknown>): FeedbackInput {
  const extra = Object.keys(body).filter((k) => !['dateRating', 'dateComment', 'venueRating', 'venueComment'].includes(k))
  if (extra.length) throw new ApiError(400, 'invalid_request', 'Feedback is two ratings and optional comments.')
  const rating = (v: unknown, field: string) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) throw new ApiError(400, 'invalid_request', 'Rate from 1 to 5.', { [field]: 'Rate from 1 to 5.' })
    return v
  }
  const comment = (v: unknown, field: string) => {
    const s = typeof v === 'string' ? v.trim() : ''
    if (s.length > 500) throw new ApiError(400, 'invalid_request', 'Keep comments to 500 characters.', { [field]: 'Too long.' })
    return s
  }
  return { dateRating: rating(body.dateRating, 'dateRating'), dateComment: comment(body.dateComment, 'dateComment'), venueRating: rating(body.venueRating, 'venueRating'), venueComment: comment(body.venueComment, 'venueComment') }
}

export async function submitBookingFeedback(viewer: PublicUser, id: string, input: FeedbackInput): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'ended') throw new ApiError(409, 'not_open', 'You can rate a date once it has ended.')
    const until = new Date(b.ended_at!).getTime() + cfg().feedbackDays * 86_400_000
    if (Date.now() > until) throw new ApiError(409, 'window_closed', 'The rating window for this date has closed.')
    if ((await q.query('select 1 from booking_feedback where booking_id = $1 and user_id = $2', [b.id, viewer.id])).rows.length) throw new ApiError(409, 'already_sent', 'You have already rated this date.')
    await q.query(
      `insert into booking_feedback (booking_id, user_id, date_rating, date_comment, venue_rating, venue_comment, comment_status) values ($1, $2, $3, $4, $5, $6, $7)`,
      [b.id, viewer.id, input.dateRating, input.dateComment, input.venueRating, input.venueComment, input.venueComment ? 'pending' : 'approved'],
    )
    await logBookingEvent(q, b.id, 'feedback_given', { actor: 'dater', actorId: viewer.id })
  })
  return { ok: true }
}

/** Both daters ask for another date: the match gets a fresh booking with the redate rules. */
export async function requestRedate(viewer: PublicUser, id: string): Promise<{ ok: true; mutual: boolean }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  return db.tx(async (q) => {
    const b = await loadMine(q, viewer, id, true)
    if (b.status !== 'ended') throw new ApiError(409, 'not_open', 'You can ask for a redate once the date has ended.')
    await q.query('insert into redate_requests (booking_id, user_id) values ($1, $2) on conflict do nothing', [b.id, viewer.id])
    const n = (await q.query<{ n: number }>('select count(*)::int as n from redate_requests where booking_id = $1', [b.id])).rows[0].n
    if (n < 2) return { ok: true as const, mutual: false }
    const fresh = await rebook(q, { ...b, kind: 'redate' })
    await logBookingEvent(q, b.id, 'redate_agreed', { actor: 'system', meta: { next: fresh?.id } })
    return { ok: true as const, mutual: true }
  })
}

/** Builds the QR token for a dater's own booking (never for someone else's). */
export async function qrFor(q: Queryable, b: BookingRow, userId: string): Promise<string | null> {
  const g = (await q.query<{ qr_nonce: string }>('select qr_nonce from booking_guests where booking_id = $1 and user_id = $2', [b.id, userId])).rows[0]
  return g ? makeQrToken({ b: b.id, u: userId, n: g.qr_nonce }) : null
}

/** What the venue's confirmation sets up: each dater's one-time QR nonce and the shared 4-digit code. */
export async function issueCodes(q: Queryable, b: BookingRow): Promise<string> {
  const code = newBookingCode()
  for (const uid of [b.user_a, b.user_b]) {
    await q.query('insert into booking_guests (booking_id, user_id, qr_nonce) values ($1, $2, $3) on conflict (booking_id, user_id) do update set qr_nonce = excluded.qr_nonce, checked_in_at = null, left_at = null', [b.id, uid, newNonce()])
  }
  await q.query('update bookings set booking_code = $2 where id = $1', [b.id, code])
  return code
}

export { memberLink }
