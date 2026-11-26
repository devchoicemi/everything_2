import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import type { PublicUser } from '../auth/service'
import { assertCanBrowse } from '../compat/discover'
import { slotStates, loadRules } from '../social/availability'
import { NONE_REASON_TEXT, cfg, type BookingStatus, type NoneReason } from './config'
import { COLS, loadMine, other, qrFor, type BookingRow } from './service'
import { UUID, normaliseDateKey } from './util'

/** What a dater sees of a booking: the planning rounds, then the date card. Never another dater's details beyond the username. */
export interface OptionView {
  id: string
  round: number
  sentByMe: boolean
  venueId: string
  venueName: string
  venueArea: string
  dateOn: string
  time: string
  startAt: string
  status: 'offered' | 'picked' | 'turned_down' | 'expired'
}

export interface VenueCard {
  id: string
  name: string
  area: string
  address: string
  lat: number | null
  lng: number | null
  mapUrl: string | null
  offer: string
  description: string
  stepFree: boolean | null
  accessibleToilet: boolean | null
  priceLevel: number | null
  photos: { slot: number; label: string; url: string }[]
}

export type BookingAction = 'send_options' | 'pick' | 'none' | 'confirm' | 'withdraw' | 'cancel' | 'late' | 'leave' | 'no_show' | 'feedback' | 'redate' | 'report'

export interface DaterBookingView {
  id: string
  ref: string
  matchId: string
  kind: 'first' | 'redate'
  status: BookingStatus
  partner: { id: string; username: string }
  window: { from: string; to: string }
  round: number
  turn: 'me' | 'them' | null
  deadlineAt: string | null
  options: OptionView[]
  /** the earlier sets and what happened to them, for the "None of these" reasons */
  turns: { round: number; by: 'me' | 'them'; action: 'sent' | 'picked' | 'none'; reasons: string[] }[]
  picked: OptionView | null
  venue: VenueCard | null
  dateOn: string | null
  time: string | null
  startAt: string | null
  /** only while the date is booked and only the viewer's own code */
  qr: string | null
  bookingCode: string | null
  me: { checkedInAt: string | null; leftAt: string | null; lateNote: number | null }
  partnerCheckedIn: boolean
  partnerLateNote: number | null
  offerClaimed: boolean
  endedAt: string | null
  feedback: { given: boolean; closesAt: string | null }
  redate: { mine: boolean; theirs: boolean }
  cancelledBy: 'me' | 'them' | 'venue' | 'system' | null
  lateCancel: boolean
  closedReason: string | null
  noShowIsMine: boolean | null
  actions: BookingAction[]
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)

export const PHOTO_LABELS = ['Outside the venue', 'The entrance', 'Inside, looking in', 'Inside, looking back'] as const

const mapUrl = (lat: number | null, lng: number | null, name: string) =>
  lat !== null && lng !== null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}` : name ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}` : null

async function venueCard(q: Queryable, id: string, withPhotos: boolean): Promise<VenueCard | null> {
  const v = (
    await q.query<{ id: string; name: string; area: string; address: string; formatted_address: string | null; lat: number | null; lng: number | null; offer: string; description: string; step_free: boolean | null; accessible_toilet: boolean | null; price_level: number | null }>(
      'select id, name, area, address, formatted_address, lat, lng, offer, description, step_free, accessible_toilet, price_level from venues where id = $1',
      [id],
    )
  ).rows[0]
  if (!v) return null
  const photos = withPhotos
    ? (await q.query<{ slot: number }>(`select slot from venue_photos where venue_id = $1 and status = 'accepted' order by slot`, [id])).rows.map((p) => ({ slot: p.slot, label: PHOTO_LABELS[p.slot - 1], url: `/api/v1/venues/${id}/photos/${p.slot}` }))
    : []
  const address = v.formatted_address || v.address
  return { id: v.id, name: v.name, area: v.area, address, lat: v.lat, lng: v.lng, mapUrl: mapUrl(v.lat, v.lng, `${v.name} ${address}`), offer: v.offer, description: v.description, stepFree: v.step_free, accessibleToilet: v.accessible_toilet, priceLevel: v.price_level, photos }
}

async function optionsOf(q: Queryable, b: BookingRow, viewerId: string): Promise<OptionView[]> {
  const { rows } = await q.query<{ id: string; round: number; sent_by: string; venue_id: string; vname: string; varea: string; date_on: string; start_time: string; start_at: Date; status: OptionView['status'] }>(
    `select o.id, o.round, o.sent_by, o.venue_id, v.name as vname, v.area as varea, to_char(o.date_on, 'YYYY-MM-DD') as date_on, o.start_time, o.start_at, o.status
       from booking_options o join venues v on v.id = o.venue_id where o.booking_id = $1 order by o.round, o.date_on, o.start_time`,
    [b.id],
  )
  return rows.map((r) => ({ id: r.id, round: r.round, sentByMe: r.sent_by === viewerId, venueId: r.venue_id, venueName: r.vname, venueArea: r.varea, dateOn: r.date_on, time: r.start_time, startAt: new Date(r.start_at).toISOString(), status: r.status }))
}

function actionsFor(b: BookingRow, viewerId: string, extra: { feedbackOpen: boolean; redateMine: boolean; checkedIn: boolean }): BookingAction[] {
  const out: BookingAction[] = []
  const expired = b.deadline_at ? new Date(b.deadline_at).getTime() < Date.now() : false
  switch (b.status) {
    case 'proposed':
      if (b.rounds === 0) out.push('send_options')
      else if (b.turn_user === viewerId && !expired) out.push('pick', 'none')
      break
    case 'picked':
      if (b.sender_id === viewerId && !expired) out.push('confirm')
      break
    case 'requested':
      out.push('withdraw')
      break
    case 'confirmed':
      out.push('cancel', 'late', 'report')
      break
    case 'partially_checked_in': {
      out.push('late', 'report')
      if (extra.checkedIn && b.start_at && Date.now() >= new Date(b.start_at).getTime() + cfg().noShowGraceMin * 60_000) out.push('no_show')
      break
    }
    case 'in_progress':
      out.push('leave', 'report')
      break
    case 'ended':
      if (extra.feedbackOpen) out.push('feedback')
      if (!extra.redateMine) out.push('redate')
      out.push('report')
      break
    case 'no_show':
      out.push('report')
      break
  }
  return out
}

export async function bookingView(q: Queryable, b: BookingRow, viewerId: string): Promise<DaterBookingView> {
  const partnerId = other(b, viewerId)
  const partner = (await q.query<{ username: string }>('select username from users where id = $1', [partnerId])).rows[0]
  const options = await optionsOf(q, b, viewerId)
  const current = options.filter((o) => o.round === b.rounds && o.status === 'offered')
  const picked = b.picked_option_id ? (options.find((o) => o.id === b.picked_option_id) ?? null) : null
  const turnsRaw = await q.query<{ round: number; actor: string; action: 'sent' | 'picked' | 'none'; reasons: string[] }>('select round, actor, action, reasons from booking_turns where booking_id = $1 order by id', [b.id])
  const turns = turnsRaw.rows.map((t) => ({ round: t.round, by: (t.actor === viewerId ? 'me' : 'them') as 'me' | 'them', action: t.action, reasons: t.reasons.map((r) => NONE_REASON_TEXT[r as NoneReason] ?? r) }))

  const booked = ['confirmed', 'partially_checked_in', 'in_progress', 'ended', 'no_show'].includes(b.status)
  const guests = (await q.query<{ user_id: string; checked_in_at: Date | null; left_at: Date | null; late_note: number | null }>('select user_id, checked_in_at, left_at, late_note from booking_guests where booking_id = $1', [b.id])).rows
  const mine = guests.find((g) => g.user_id === viewerId)
  const theirs = guests.find((g) => g.user_id === partnerId)

  const fb = (await q.query('select 1 from booking_feedback where booking_id = $1 and user_id = $2', [b.id, viewerId])).rows.length > 0
  const closesAt = b.ended_at ? new Date(new Date(b.ended_at).getTime() + cfg().feedbackDays * 86_400_000) : null
  const feedbackOpen = b.status === 'ended' && !fb && !!closesAt && closesAt.getTime() > Date.now()
  const rd = (await q.query<{ user_id: string }>('select user_id from redate_requests where booking_id = $1', [b.id])).rows
  const redateMine = rd.some((r) => r.user_id === viewerId)

  const showCode = b.status === 'confirmed' || b.status === 'partially_checked_in'
  const cancelledBy: DaterBookingView['cancelledBy'] = b.status === 'cancelled' ? (b.cancelled_role === 'venue' ? 'venue' : b.cancelled_role === 'system' ? 'system' : b.cancelled_by === viewerId ? 'me' : 'them') : null

  return {
    id: b.id,
    ref: b.ref,
    matchId: b.match_id,
    kind: b.kind,
    status: b.status,
    partner: { id: partnerId, username: partner?.username ?? 'Your match' },
    window: { from: b.window_start, to: b.window_end },
    round: b.rounds,
    turn: b.status === 'proposed' && b.rounds > 0 ? (b.turn_user === viewerId ? 'me' : 'them') : b.status === 'picked' ? (b.sender_id === viewerId ? 'me' : 'them') : null,
    deadlineAt: iso(b.deadline_at),
    options: current,
    turns,
    picked,
    venue: b.venue_id ? await venueCard(q, b.venue_id, booked) : null,
    dateOn: b.date_on,
    time: b.start_time,
    startAt: iso(b.start_at),
    qr: showCode ? await qrFor(q, b, viewerId) : null,
    bookingCode: showCode ? b.booking_code : null,
    me: { checkedInAt: iso(mine?.checked_in_at), leftAt: iso(mine?.left_at), lateNote: mine?.late_note ?? null },
    partnerCheckedIn: Boolean(theirs?.checked_in_at),
    partnerLateNote: theirs?.late_note ?? null,
    offerClaimed: Boolean(b.offer_claimed_at),
    endedAt: iso(b.ended_at),
    feedback: { given: fb, closesAt: iso(closesAt) },
    redate: { mine: redateMine, theirs: rd.some((r) => r.user_id === partnerId) },
    cancelledBy,
    lateCancel: b.late_cancel,
    closedReason: b.closed_reason,
    noShowIsMine: b.status === 'no_show' ? b.no_show_user === viewerId : null,
    actions: actionsFor(b, viewerId, { feedbackOpen, redateMine, checkedIn: Boolean(mine?.checked_in_at) }),
  }
}

export async function getBooking(viewer: PublicUser, id: string): Promise<{ booking: DaterBookingView }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const b = await loadMine(db, viewer, id)
  return { booking: await bookingView(db, b, viewer.id) }
}

/** The latest booking on a match, whatever state it is in. */
export async function bookingForMatch(viewer: PublicUser, matchId: string): Promise<{ booking: DaterBookingView | null }> {
  assertCanBrowse(viewer)
  if (!UUID.test(matchId)) throw new ApiError(404, 'not_found', 'No such match.')
  const db = await getDb()
  const { rows } = await db.query<BookingRow>(`select ${COLS} from bookings b where b.match_id = $1 and (b.user_a = $2 or b.user_b = $2) order by b.created_at desc limit 1`, [matchId, viewer.id])
  return { booking: rows[0] ? await bookingView(db, rows[0], viewer.id) : null }
}

export interface BookingSummary {
  id: string
  ref: string
  status: BookingStatus
  partner: string
  venueName: string | null
  dateOn: string | null
  time: string | null
  startAt: string | null
  needsMe: boolean
  window: { from: string; to: string }
}

/** My bookings, newest first, grouped by the page into "needs you", "coming up" and "past". */
export async function listBookings(viewer: PublicUser): Promise<{ bookings: BookingSummary[] }> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const { rows } = await db.query<BookingRow & { partner: string; venue_name: string | null }>(
    `select ${COLS}, p.username as partner, v.name as venue_name
       from bookings b
       join users p on p.id = case when b.user_a = $1 then b.user_b else b.user_a end
       left join venues v on v.id = b.venue_id
      where b.user_a = $1 or b.user_b = $1 order by b.created_at desc limit 100`,
    [viewer.id],
  )
  const bookings = rows.map((b) => {
    const expired = b.deadline_at ? new Date(b.deadline_at).getTime() < Date.now() : false
    const needsMe = (b.status === 'proposed' && b.rounds === 0) || (b.status === 'proposed' && b.turn_user === viewer.id && !expired) || (b.status === 'picked' && b.sender_id === viewer.id && !expired)
    return { id: b.id, ref: b.ref, status: b.status, partner: b.partner, venueName: b.venue_name, dateOn: b.date_on, time: b.start_time, startAt: iso(b.start_at), needsMe, window: { from: b.window_start, to: b.window_end } }
  })
  return { bookings }
}

/* --------------------------------------------------------------- venues */

export interface VenueListItem {
  id: string
  name: string
  area: string
  kind: string
  offer: string
  address: string
  priceLevel: number | null
  stepFree: boolean | null
}

/** The partner venues daters can choose from. First dates happen only here. */
export async function listVenues(): Promise<VenueListItem[]> {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; name: string; area: string; kind: string; offer: string; address: string; formatted_address: string | null; price_level: number | null; step_free: boolean | null }>(
    `select id, name, area, kind, offer, address, formatted_address, price_level, step_free from venues where active and status = 'active' and review_status = 'approved' order by sort_order, name`,
  )
  return rows.map((r) => ({ id: r.id, name: r.name, area: r.area, kind: r.kind, offer: r.offer, address: r.formatted_address || r.address, priceLevel: r.price_level, stepFree: r.step_free }))
}

export interface SlotView {
  time: string
  label: string
  available: boolean
  reason?: string
}

export async function slotsFor(venueId: string, dateKey: string): Promise<SlotView[]> {
  const dateOn = normaliseDateKey(dateKey)
  if (!dateOn) throw new ApiError(400, 'invalid_date', 'Choose a real date.')
  const db = await getDb()
  const rules = await loadRules(db, venueId)
  if (!rules || rules.status !== 'active') throw new ApiError(404, 'not_found', 'No such venue.')
  return slotStates(db, rules, dateOn)
}

/* --------------------------------------------------------- notifications */

export async function listNotifications(viewer: PublicUser) {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; event_no: number; code: string; title: string; body: string; booking_id: string | null; created_at: Date; read_at: Date | null }>(
    `select id, event_no, code, title, body, booking_id, created_at, read_at from notifications where audience = 'dater' and user_id = $1 order by created_at desc limit 100`,
    [viewer.id],
  )
  return {
    unread: rows.filter((r) => !r.read_at).length,
    notifications: rows.map((r) => ({ id: r.id, no: r.event_no, code: r.code, title: r.title, body: r.body, bookingId: r.booking_id, at: new Date(r.created_at).toISOString(), read: Boolean(r.read_at) })),
  }
}

export async function markNotificationsRead(viewer: PublicUser): Promise<{ ok: true }> {
  const db = await getDb()
  await db.query(`update notifications set read_at = now() where audience = 'dater' and user_id = $1 and read_at is null`, [viewer.id])
  return { ok: true }
}
