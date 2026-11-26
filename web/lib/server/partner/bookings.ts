import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import { rateLimit } from '../auth/rateLimit'
import { cfg, type BookingStatus } from '../booking/config'
import { logBookingEvent, setStatus } from '../booking/events'
import { Outbox, dayText, notifyAdmin, notifyDater, whenText } from '../booking/notify'
import { readQrToken } from '../booking/qr'
import { COLS, endBooking, issueCodes, loadBooking, other, rebook, type BookingRow } from '../booking/service'
import { UUID, todayHelsinki, addDays } from '../booking/util'
import { requireOwner, type PartnerContext } from './access'

/**
 * The venue's side of a booking. A venue sees just enough to seat two strangers: the reference, the day and
 * time, party of two and the two usernames. It never sees real names, scores, phone numbers or emails, and the
 * 4-digit booking code is never sent to it (staff type in what the dater says, so a username alone checks nobody in).
 */
export interface GuestView {
  username: string
  checkedInAt: string | null
  checkedInVia: 'qr' | 'manual' | null
  leftAt: string | null
  lateNote: number | null
}

export interface VenueBookingView {
  id: string
  ref: string
  status: BookingStatus
  dateOn: string
  time: string
  startAt: string
  guests: GuestView[]
  requestedAt: string | null
  answerBy: string | null
  confirmedAt: string | null
  startedAt: string | null
  endedAt: string | null
  offerClaimedAt: string | null
  /** at least one guest has tapped I have left, and the date is still running */
  guestLeft: boolean
  cancelledRole: 'dater' | 'venue' | 'system' | null
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)

async function guestsOf(q: Queryable, b: BookingRow): Promise<GuestView[]> {
  const { rows } = await q.query<{ username: string; checked_in_at: Date | null; checkin_via: 'qr' | 'manual' | null; left_at: Date | null; late_note: number | null }>(
    `select u.username, g.checked_in_at, g.checkin_via, g.left_at, g.late_note
       from (values ($2::uuid, 1), ($3::uuid, 2)) as m(uid, ord)
       join users u on u.id = m.uid
       left join booking_guests g on g.booking_id = $1 and g.user_id = m.uid
      order by m.ord`,
    [b.id, b.user_a, b.user_b],
  )
  return rows.map((r) => ({ username: r.username, checkedInAt: iso(r.checked_in_at), checkedInVia: r.checkin_via, leftAt: iso(r.left_at), lateNote: r.late_note }))
}

async function toView(q: Queryable, b: BookingRow): Promise<VenueBookingView> {
  const guests = await guestsOf(q, b)
  return {
    id: b.id,
    ref: b.ref,
    status: b.status,
    dateOn: b.date_on!,
    time: b.start_time!,
    startAt: new Date(b.start_at!).toISOString(),
    guests,
    requestedAt: iso(b.requested_at),
    answerBy: b.status === 'requested' ? iso(b.venue_deadline_at) : null,
    confirmedAt: iso(b.confirmed_at),
    startedAt: iso(b.started_at),
    endedAt: iso(b.ended_at),
    offerClaimedAt: iso(b.offer_claimed_at),
    guestLeft: b.status === 'in_progress' && guests.some((g) => g.leftAt),
    cancelledRole: b.cancelled_role,
  }
}

async function ownBooking(q: Queryable, ctx: PartnerContext, id: string, lock = true): Promise<BookingRow> {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such booking.')
  const { rows } = await q.query<BookingRow>(`select ${COLS} from bookings b where b.id = $1 and b.venue_id = $2 ${lock ? 'for update' : ''}`, [id, ctx.venue.id])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such booking.')
  return rows[0]
}

/* ------------------------------------------------------------------ lists */

/** Requests waiting for a yes or no, soonest deadline first. */
export async function requests(ctx: PartnerContext): Promise<{ requests: VenueBookingView[] }> {
  const db = await getDb()
  const { rows } = await db.query<BookingRow>(`select ${COLS} from bookings b where b.venue_id = $1 and b.status = 'requested' order by b.venue_deadline_at`, [ctx.venue.id])
  return { requests: await Promise.all(rows.map((r) => toView(db, r))) }
}

const MAX_RANGE_DAYS = 62

/** Bookings between two days. Details leave the portal 30 days after the date. */
export async function bookingsBetween(ctx: PartnerContext, from: unknown, to: unknown): Promise<{ bookings: VenueBookingView[]; pending: number }> {
  const db = await getDb()
  const today = await todayHelsinki(db)
  const a = typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : today
  const b = typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : addDays(a, 6)
  const span = (Date.parse(b) - Date.parse(a)) / 86_400_000
  if (span < 0 || span > MAX_RANGE_DAYS) throw new ApiError(400, 'invalid_date', `Ask for at most ${MAX_RANGE_DAYS} days at a time.`)
  const oldest = addDays(today, -cfg().venueRetentionDays)
  const { rows } = await db.query<BookingRow>(
    `select ${COLS} from bookings b
      where b.venue_id = $1 and b.date_on between $2::date and $3::date and b.date_on >= $4::date
        and b.status in ('confirmed', 'partially_checked_in', 'in_progress', 'ended', 'no_show', 'cancelled')
      order by b.start_at`,
    [ctx.venue.id, a, b, oldest],
  )
  const pending = (await db.query<{ n: number }>(`select count(*)::int as n from bookings where venue_id = $1 and status = 'requested'`, [ctx.venue.id])).rows[0].n
  return { bookings: await Promise.all(rows.map((r) => toView(db, r))), pending }
}

export async function bookingDetail(ctx: PartnerContext, id: string): Promise<{ booking: VenueBookingView; events: { at: string; event: string; to: string | null }[] }> {
  const db = await getDb()
  const b = await ownBooking(db, ctx, id, false)
  const ev = await db.query<{ at: Date; event: string; to_status: string | null }>(`select at, event, to_status from booking_events where booking_id = $1 and (actor_type <> 'dater' or event in ('dater_left', 'running_late')) order by at`, [b.id])
  return { booking: await toView(db, b), events: ev.rows.map((e) => ({ at: new Date(e.at).toISOString(), event: e.event, to: e.to_status })) }
}

/** What needs the staff right now: requests to answer, dates that may have ended, guests who are late. */
export async function attention(ctx: PartnerContext) {
  const db = await getDb()
  const reqs = await requests(ctx)
  const ended = (
    await db.query<BookingRow>(
      `select ${COLS} from bookings b where b.venue_id = $1 and b.status = 'in_progress'
         and exists (select 1 from booking_guests g where g.booking_id = b.id and g.left_at is not null) order by b.start_at`,
      [ctx.venue.id],
    )
  ).rows
  const unread = (await db.query<{ n: number }>(`select count(*)::int as n from notifications where audience = 'venue' and venue_id = $1 and read_at is null`, [ctx.venue.id])).rows[0].n
  return { requests: reqs.requests, mayHaveEnded: await Promise.all(ended.map((r) => toView(db, r))), unreadAlerts: unread }
}

/* ------------------------------------------------------------ the answer */

export async function confirmRequest(req: Request, ctx: PartnerContext, id: string): Promise<VenueBookingView> {
  const db = await getDb()
  const out = new Outbox()
  const view = await db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'requested') throw new ApiError(409, 'not_open', 'This request has already been answered.')
    const code = await issueCodes(q, b)
    await setStatus(q, b, 'confirmed', 'venue_confirmed', { type: 'venue', id: ctx.user.id }, {}, { confirmed_at: new Date(), venue_answered_by: ctx.user.id, venue_deadline_at: null })
    const fresh = await loadBooking(q, id)
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, {
        userId: uid,
        bookingId: b.id,
        no: 10,
        code: 'confirmed',
        title: `${ctx.venue.name} confirmed your date`,
        body: `${whenText(b.date_on!, b.start_time!)}. Your date card has your QR code and booking code ${code}.`,
      })
    }
    return toView(q, fresh)
  })
  await out.flush()
  return view
}

export async function declineRequest(req: Request, ctx: PartnerContext, id: string): Promise<{ ok: true }> {
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'requested') throw new ApiError(409, 'not_open', 'This request has already been answered.')
    await setStatus(q, b, 'declined', 'venue_declined', { type: 'venue', id: ctx.user.id }, {}, { venue_answered_by: ctx.user.id, venue_deadline_at: null })
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 11, code: 'declined', title: `${ctx.venue.name} can't host this time`, body: 'Plan another time or venue within your date window.' })
    }
    await rebook(q, b)
  })
  return { ok: true }
}

/** The venue calls off a confirmed booking (for example it has to close). Both daters are told, offered a rebooking, and admin is flagged. */
export async function cancelBooking(req: Request, ctx: PartnerContext, id: string): Promise<{ ok: true }> {
  requireOwner(ctx)
  const db = await getDb()
  await db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'confirmed') throw new ApiError(409, 'not_confirmed', 'Only a confirmed booking can be cancelled.')
    if (new Date(b.start_at!).getTime() <= Date.now()) throw new ApiError(409, 'already_started', 'This booking has already started.')
    await setStatus(q, b, 'cancelled', 'cancelled_by_venue', { type: 'venue', id: ctx.user.id }, {}, { cancelled_at: new Date(), cancelled_by: ctx.user.id, cancelled_role: 'venue' })
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 19, code: 'cancelled', title: `${ctx.venue.name} cancelled your date`, body: 'You can plan another date within your window.' })
    }
    await notifyAdmin(q, { bookingId: b.id, no: 19, code: 'venue_cancelled', title: 'Venue cancelled a confirmed booking', body: `${ctx.venue.name} cancelled ${b.ref} (${whenText(b.date_on!, b.start_time!)}).` })
    await rebook(q, b)
  })
  return { ok: true }
}

/* ---------------------------------------------------------------- check-in */

function assertScanWindow(b: BookingRow) {
  const c = cfg()
  const start = new Date(b.start_at!).getTime()
  if (Date.now() < start - c.qrBeforeMin * 60_000) throw new ApiError(409, 'too_early', `Check-in opens ${c.qrBeforeMin} minutes before the start time.`)
  if (Date.now() > start + c.qrAfterMin * 60_000) throw new ApiError(409, 'too_late', `Check-in closed ${c.qrAfterMin} minutes after the start time.`)
}

export interface CheckInResult {
  booking: VenueBookingView
  /** the guest just scanned */
  username: string
  started: boolean
}

/** Marks one dater as arrived; the second arrival starts the date for both. */
async function arrive(q: Queryable, ctx: PartnerContext, b: BookingRow, userId: string, via: 'qr' | 'manual'): Promise<CheckInResult> {
  const g = (await q.query<{ checked_in_at: Date | null }>('select checked_in_at from booking_guests where booking_id = $1 and user_id = $2 for update', [b.id, userId])).rows[0]
  if (!g) throw new ApiError(404, 'not_found', 'That guest is not on this booking.')
  if (g.checked_in_at) throw new ApiError(409, 'already_checked_in', 'This guest is already checked in.')
  const username = (await q.query<{ username: string }>('select username from users where id = $1', [userId])).rows[0].username
  await q.query('update booking_guests set checked_in_at = now(), checkin_via = $3 where booking_id = $1 and user_id = $2', [b.id, userId, via])
  await logBookingEvent(q, b.id, 'checked_in', { actor: 'venue', actorId: ctx.user.id, meta: { via, username } })
  const count = (await q.query<{ n: number }>('select count(*)::int as n from booking_guests where booking_id = $1 and checked_in_at is not null', [b.id])).rows[0].n
  let started = false
  if (count >= 2) {
    started = true
    await setStatus(q, b, 'in_progress', 'date_started', { type: 'venue', id: ctx.user.id }, {}, { started_at: new Date() })
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 15, code: 'started', title: `Your date at ${ctx.venue.name} has started`, body: 'Enjoy your evening.' })
    }
    await q.query(
      `insert into notifications (audience, venue_id, booking_id, event_no, code, title, body, channels) values ('venue', $1, $2, 15, 'started', $3, $4, '{portal}')`,
      [ctx.venue.id, b.id, `${b.ref}: the date has started`, 'Both guests are checked in.'],
    )
  } else {
    await setStatus(q, b, 'partially_checked_in', 'first_checked_in', { type: 'venue', id: ctx.user.id }, {}, {})
    await notifyDater(q, { userId, bookingId: b.id, no: 14, code: 'checked_in', title: "You're checked in", body: "Your date hasn't arrived yet." })
  }
  return { booking: await toView(q, await loadBooking(q, b.id)), username, started }
}

export async function checkInByQr(req: Request, ctx: PartnerContext, token: unknown): Promise<CheckInResult> {
  await rateLimit('partner-scan', ctx.venue.id, 240, 900)
  const claims = readQrToken(token)
  if (!claims) throw new ApiError(400, 'invalid_qr', 'That is not a ChoiceMi code. Ask for the username and booking code instead.')
  const db = await getDb()
  return db.tx(async (q) => {
    if (!UUID.test(claims.b)) throw new ApiError(400, 'invalid_qr', 'That is not a ChoiceMi code.')
    const b = await ownBooking(q, ctx, claims.b)
    if (b.status !== 'confirmed' && b.status !== 'partially_checked_in') throw new ApiError(409, 'not_open', 'This booking is not waiting for guests.')
    const g = (await q.query<{ qr_nonce: string }>('select qr_nonce from booking_guests where booking_id = $1 and user_id = $2', [b.id, claims.u])).rows[0]
    if (!g || g.qr_nonce !== claims.n) throw new ApiError(400, 'invalid_qr', 'This code is no longer valid. Ask for the username and booking code instead.')
    assertScanWindow(b)
    return arrive(q, ctx, b, claims.u, 'qr')
  })
}

/** Fallback when a scan fails: the username and the 4-digit booking code, matched together. A username alone never works. */
export async function checkInManual(req: Request, ctx: PartnerContext, body: Record<string, unknown>): Promise<CheckInResult> {
  await rateLimit('partner-manual', ctx.venue.id, 60, 900)
  const username = typeof body.username === 'string' ? body.username.trim().replace(/^@/, '').toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : ''
  if (!username || !/^\d{4}$/.test(code)) throw new ApiError(400, 'invalid_request', 'Enter the username and the 4-digit booking code.')
  const db = await getDb()
  return db.tx(async (q) => {
    const found = (
      await q.query<{ id: string; user_id: string }>(
        `select b.id, u.id as user_id from bookings b join users u on u.id in (b.user_a, b.user_b)
          where b.venue_id = $1 and b.booking_code = $2 and lower(u.username) = $3 and b.status in ('confirmed', 'partially_checked_in')
            and b.start_at between now() - ($4 || ' minutes')::interval and now() + ($5 || ' minutes')::interval`,
        [ctx.venue.id, code, username, String(cfg().qrAfterMin), String(cfg().qrBeforeMin)],
      )
    ).rows[0]
    if (!found) throw new ApiError(404, 'no_match', 'No booking right now has that username and code together. Check both with the guest.')
    const b = await ownBooking(q, ctx, found.id)
    return arrive(q, ctx, b, found.user_id, 'manual')
  })
}

/** The offer the venue gives ChoiceMi guests, marked as given. */
export async function claimOffer(req: Request, ctx: PartnerContext, id: string): Promise<VenueBookingView> {
  const db = await getDb()
  return db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'in_progress' && b.status !== 'partially_checked_in') throw new ApiError(409, 'not_open', 'The offer can be given once guests have checked in.')
    if (b.offer_claimed_at) throw new ApiError(409, 'already_claimed', 'The offer was already given.')
    await q.query('update bookings set offer_claimed_at = now() where id = $1', [b.id])
    await logBookingEvent(q, b.id, 'offer_claimed', { actor: 'venue', actorId: ctx.user.id })
    return toView(q, await loadBooking(q, b.id))
  })
}

/* ---------------------------------------------------------- end and no-show */

/** Staff confirm the date has ended (the "has this date ended?" pop-up). */
export async function endByStaff(req: Request, ctx: PartnerContext, id: string): Promise<VenueBookingView> {
  const db = await getDb()
  return db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'in_progress') throw new ApiError(409, 'not_open', 'This date is not running.')
    await endBooking(q, b, 'staff', { type: 'venue', id: ctx.user.id })
    return toView(q, await loadBooking(q, b.id))
  })
}

/** Staff mark a no-show: neither guest came (from confirmed), or one did not come (after the grace period). */
export async function noShowByStaff(req: Request, ctx: PartnerContext, id: string): Promise<VenueBookingView> {
  const db = await getDb()
  return db.tx(async (q) => {
    const b = await ownBooking(q, ctx, id)
    if (b.status !== 'confirmed' && b.status !== 'partially_checked_in') throw new ApiError(409, 'not_open', 'Only a booking waiting for guests can be marked as a no-show.')
    const grace = cfg().noShowGraceMin
    if (Date.now() < new Date(b.start_at!).getTime() + grace * 60_000) throw new ApiError(409, 'too_early', `Wait ${grace} minutes past the start time before marking a no-show.`)
    let absent: string | null = null
    if (b.status === 'partially_checked_in') {
      const missing = (await q.query<{ user_id: string }>('select user_id from booking_guests where booking_id = $1 and checked_in_at is null', [b.id])).rows[0]
      absent = missing?.user_id ?? null
    }
    await setStatus(q, b, 'no_show', 'no_show_by_venue', { type: 'venue', id: ctx.user.id }, { absent }, { no_show_at: new Date(), no_show_by: 'venue', no_show_user: absent })
    if (absent) {
      await notifyDater(q, { userId: other(b, absent), bookingId: b.id, no: 20, code: 'no_show', title: 'No-show recorded', body: 'Your date did not arrive. You are free to leave, and there is no penalty for you.' })
    }
    await notifyAdmin(q, { bookingId: b.id, no: 20, code: 'no_show', title: 'No-show', body: `${b.ref} at ${ctx.venue.name}: ${absent ? 'one guest' : 'neither guest'} did not arrive.` })
    return toView(q, await loadBooking(q, b.id))
  })
}

/* ------------------------------------------------------------ the inbox */

export async function alerts(ctx: PartnerContext) {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; event_no: number; code: string; title: string; body: string; created_at: Date; read_at: Date | null; booking_id: string | null }>(
    `select id, event_no, code, title, body, created_at, read_at, booking_id from notifications where audience = 'venue' and venue_id = $1 order by created_at desc limit 100`,
    [ctx.venue.id],
  )
  return { alerts: rows.map((r) => ({ id: r.id, no: r.event_no, code: r.code, title: r.title, body: r.body, at: new Date(r.created_at).toISOString(), read: Boolean(r.read_at), bookingId: r.booking_id })) }
}

export async function markAlertsRead(ctx: PartnerContext): Promise<{ ok: true }> {
  const db = await getDb()
  await db.query(`update notifications set read_at = now() where audience = 'venue' and venue_id = $1 and read_at is null`, [ctx.venue.id])
  return { ok: true }
}

export { dayText }
