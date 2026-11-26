import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { partnerBaseUrl } from '../auth/config'
import { logEvent } from '../auth/events'
import { noticeMail, sendMail } from '../auth/mailer'
import { audit, type StaffContext } from '../staff/access'
import { COLS, type BookingRow } from '../booking/service'
import { cfg } from '../booking/config'
import { notifyDater } from '../booking/notify'

/**
 * ChoiceMi's side: reviewing venue applications, watching every booking, and checking comments before a venue
 * sees them. Each function is called behind a permission check (see staff/access.ts).
 */
export type AdminActor = StaffContext

/* ------------------------------------------------------------- venue review */

export const REVIEW_ITEMS = ['name', 'business_id', 'location', 'hours', 'contact', 'photo1', 'photo2', 'photo3', 'photo4', 'offer'] as const
type ReviewItem = (typeof REVIEW_ITEMS)[number]

export async function reviewQueue(url: URL) {
  const status = url.searchParams.get('status')
  if (status && !['draft', 'submitted', 'sent_back', 'approved'].includes(status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')
  const db = await getDb()
  const { rows } = await db.query(
    `select id, name, area, business_id, review_status, status, submitted_at, reviewed_at, went_live_at, contact_name, contact_email
       from venues where ($1::text is null and review_status <> 'draft') or review_status = $1
      order by (review_status = 'submitted') desc, submitted_at nulls last, name limit 200`,
    [status],
  )
  const counts = (await db.query<{ review_status: string; n: number }>('select review_status, count(*)::int as n from venues group by review_status')).rows
  return { venues: rows, counts: Object.fromEntries(counts.map((c) => [c.review_status, c.n])) }
}

export async function reviewPacket(id: string) {
  const db = await getDb()
  const v = (
    await db.query<Record<string, unknown>>(
      `select id, name, kind, area, description, business_id, ytj, place_provider, place_id, lat, lng, formatted_address, contact_name, contact_role, contact_email,
              contact_email_verified_at, booking_phone, booking_phone_verified_at, hours, slot_times, capacity, offer, step_free, accessible_toilet, price_level,
              review_status, review, submitted_at, reviewed_at, terms_accepted_at, photo_rights_at, marketing_photos, device_ready_at, staff_briefed_at, test_done_at, went_live_at, status
         from venues where id = $1`,
      [id],
    )
  ).rows[0]
  if (!v) throw new ApiError(404, 'not_found', 'No such venue.')
  const photos = (await db.query<{ slot: number; status: string; reject_reason: string; width: number; height: number; bytes: number; checks: Record<string, unknown>; taken_on: string | null }>(
    `select slot, status, reject_reason, width, height, bytes, checks, to_char(taken_on, 'YYYY-MM-DD') as taken_on from venue_photos where venue_id = $1 order by slot`,
    [id],
  )).rows.map((p) => ({ ...p, url: `/api/v1/venues/${id}/photos/${p.slot}` }))
  const owner = (await db.query<{ email: string }>(`select u.email from venue_staff s join users u on u.id = s.user_id where s.venue_id = $1 and s.role = 'owner' limit 1`, [id])).rows[0]
  return { venue: v, photos, owner: owner?.email ?? null }
}

type ItemVerdict = { ok: true } | { ok: false; reason: string }

export async function decideReview(req: Request, actor: AdminActor, id: string, body: Record<string, unknown>) {
  const decision = body.decision
  if (decision !== 'approve' && decision !== 'send_back') throw new ApiError(400, 'invalid_request', 'Decision must be approve or send_back.')
  const raw = (body.items ?? {}) as Record<string, unknown>
  const items: Partial<Record<ReviewItem, ItemVerdict>> = {}
  for (const k of REVIEW_ITEMS) {
    const x = raw[k] as { ok?: unknown; reason?: unknown } | undefined
    if (!x) continue
    if (x.ok === true) items[k] = { ok: true }
    else if (x.ok === false) {
      const reason = typeof x.reason === 'string' ? x.reason.trim().slice(0, 300) : ''
      if (!reason) throw new ApiError(400, 'reason_required', 'Say why an item failed, so the venue knows what to fix.')
      items[k] = { ok: false, reason }
    }
  }
  const failed = REVIEW_ITEMS.filter((k) => items[k] && !items[k]!.ok)
  if (decision === 'approve' && failed.length) throw new ApiError(400, 'items_failed', 'You cannot approve while an item is marked as failed.')
  if (decision === 'send_back' && failed.length === 0) throw new ApiError(400, 'nothing_to_fix', 'Mark at least one item as failed, with a reason, to send it back.')
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
  const db = await getDb()
  const v = await db.tx(async (q) => {
    const row = (await q.query<{ name: string; review_status: string; business_id: string | null }>('select name, review_status, business_id from venues where id = $1 for update', [id])).rows[0]
    if (!row) throw new ApiError(404, 'not_found', 'No such venue.')
    if (row.review_status !== 'submitted') throw new ApiError(409, 'not_submitted', 'This application is not waiting for review.')
    const review = JSON.stringify({ items, note, decidedAt: new Date().toISOString() })
    if (decision === 'approve') {
      await q.query(`update venues set review_status = 'approved', review = $2::jsonb, reviewed_at = now() where id = $1`, [id, review])
      await q.query(`update venue_photos set status = 'accepted', reject_reason = '' where venue_id = $1`, [id])
    } else {
      await q.query(`update venues set review_status = 'sent_back', review = $2::jsonb, reviewed_at = now() where id = $1`, [id, review])
      for (const slot of [1, 2, 3, 4]) {
        const verdict = items[`photo${slot}` as ReviewItem]
        if (verdict && !verdict.ok) await q.query(`update venue_photos set status = 'rejected', reject_reason = $3 where venue_id = $1 and slot = $2`, [id, slot, verdict.reason])
        else await q.query(`update venue_photos set status = 'accepted', reject_reason = '' where venue_id = $1 and slot = $2`, [id, slot])
      }
    }
    await logEvent(q, decision === 'approve' ? 'venue_approved' : 'venue_sent_back', req, actor.userId, { venue: id, failed })
    await audit(q, actor, req, decision === 'approve' ? 'venue.approved' : 'venue.sent_back', { type: 'venue', id }, { failed })
    return row
  })
  const owner = (await db.query<{ email: string }>(`select u.email from venue_staff s join users u on u.id = s.user_id where s.venue_id = $1 and s.role = 'owner' limit 1`, [id])).rows[0]
  if (owner) {
    if (decision === 'approve') {
      await sendMail(noticeMail(owner.email, `${v.name} is approved on ChoiceMi`, ['ChoiceMi has checked your application and approved it.', 'Next: set up your check-in device, brief your staff, and run a test booking. Then you can go live.'], { label: 'Open the portal', url: `${partnerBaseUrl()}/onboarding/go-live` })).catch(() => {})
    } else {
      const lines = failed.map((k) => `${labelOf(k)}: ${(items[k] as { reason: string }).reason}`)
      await sendMail(noticeMail(owner.email, `${v.name}: a few things to fix`, ['ChoiceMi reviewed your application and needs these changed:', ...lines, ...(note ? [note] : [])], { label: 'Fix and resubmit', url: `${partnerBaseUrl()}/onboarding/status` })).catch(() => {})
    }
  }
  return reviewPacket(id)
}

const labelOf = (k: ReviewItem) =>
  ({ name: 'Venue name', business_id: 'Business ID', location: 'Location', hours: 'Opening hours', contact: 'Contact', photo1: 'Photo 1 (outside)', photo2: 'Photo 2 (entrance)', photo3: 'Photo 3 (inside, looking in)', photo4: 'Photo 4 (inside, looking back)', offer: 'Offer' })[k]

/* ------------------------------------------------------------ booking log */

export async function adminBookings(url: URL) {
  const status = url.searchParams.get('status')
  const venue = url.searchParams.get('venue')
  const q = url.searchParams.get('q')?.trim().slice(0, 40)
  const stalled = url.searchParams.get('stalled') === '1'
  const db = await getDb()
  const params: unknown[] = []
  const where: string[] = ['not b.is_test']
  if (status) {
    params.push(status)
    where.push(`b.status = $${params.length}`)
  }
  if (venue) {
    params.push(venue)
    where.push(`b.venue_id = $${params.length}`)
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`)
    where.push(`(lower(b.ref) like $${params.length} or exists (select 1 from users u where u.id in (b.user_a, b.user_b) and lower(u.username) like $${params.length}))`)
  }
  if (stalled) where.push(`((b.status in ('proposed', 'picked') and b.deadline_at < now()) or (b.status = 'requested' and b.venue_deadline_at < now()) or (b.status in ('confirmed', 'partially_checked_in') and b.start_at < now() - interval '1 hour'))`)
  const { rows } = await db.query<BookingRow & { ua: string; ub: string; venue_name: string | null }>(
    `select ${COLS}, ua.username as ua, ub.username as ub, v.name as venue_name
       from bookings b join users ua on ua.id = b.user_a join users ub on ub.id = b.user_b left join venues v on v.id = b.venue_id
      where ${where.join(' and ')} order by b.updated_at desc limit 200`,
    params,
  )
  const counts = (await db.query<{ status: string; n: number }>('select status, count(*)::int as n from bookings where not is_test group by status')).rows
  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    bookings: rows.map((r) => ({
      id: r.id,
      ref: r.ref,
      kind: r.kind,
      status: r.status,
      daters: [r.ua, r.ub],
      venue: r.venue_name,
      dateOn: r.date_on,
      time: r.start_time,
      deadlineAt: r.deadline_at ?? r.venue_deadline_at,
      lateCancel: r.late_cancel,
      createdAt: r.created_at,
    })),
  }
}

export async function adminBookingDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'not_found', 'No such booking.')
  const db = await getDb()
  const b = (await db.query<BookingRow & { ua: string; ub: string; venue_name: string | null }>(`select ${COLS}, ua.username as ua, ub.username as ub, v.name as venue_name from bookings b join users ua on ua.id = b.user_a join users ub on ub.id = b.user_b left join venues v on v.id = b.venue_id where b.id = $1`, [id])).rows[0]
  if (!b) throw new ApiError(404, 'not_found', 'No such booking.')
  const events = (await db.query<{ at: Date; actor_type: string; event: string; from_status: string | null; to_status: string | null; meta: unknown }>('select at, actor_type, event, from_status, to_status, meta from booking_events where booking_id = $1 order by at, id', [id])).rows
  const options = (await db.query(`select o.round, o.status, v.name as venue, to_char(o.date_on, 'YYYY-MM-DD') as date_on, o.start_time, u.username as sent_by from booking_options o join venues v on v.id = o.venue_id join users u on u.id = o.sent_by where o.booking_id = $1 order by o.round, o.date_on`, [id])).rows
  const guests = (await db.query(`select u.username, g.checked_in_at, g.checkin_via, g.left_at, g.late_note from booking_guests g join users u on u.id = g.user_id where g.booking_id = $1`, [id])).rows
  const reports = (await db.query(`select r.id, r.category, r.details, r.status, r.created_at, u.username as reporter from booking_reports r join users u on u.id = r.reporter where r.booking_id = $1 order by r.created_at`, [id])).rows
  return { booking: { id: b.id, ref: b.ref, kind: b.kind, status: b.status, daters: [b.ua, b.ub], venue: b.venue_name, dateOn: b.date_on, time: b.start_time, window: { from: b.window_start, to: b.window_end }, bookingCode: undefined, lateCancel: b.late_cancel, noShowUser: b.no_show_user, closedReason: b.closed_reason }, events, options, guests, reports }
}

/* --------------------------------------------------------------- moderation */

export async function moderationQueue() {
  const db = await getDb()
  const comments = (
    await db.query(
      `select f.booking_id, f.user_id, b.ref, v.name as venue, f.venue_rating, f.venue_comment, f.created_at
         from booking_feedback f join bookings b on b.id = f.booking_id left join venues v on v.id = b.venue_id
        where f.comment_status = 'pending' and f.venue_comment <> '' and not b.is_test order by f.created_at limit 100`,
    )
  ).rows
  const reports = (
    await db.query(
      `select r.id, r.booking_id, b.ref, r.category, r.details, r.status, r.created_at, u.username as reporter
         from booking_reports r join bookings b on b.id = r.booking_id join users u on u.id = r.reporter
        where r.status = 'open' order by r.created_at limit 100`,
    )
  ).rows
  // date ratings are admin-only: shown here so staff can spot a pattern, never to the person rated
  const dateRatings = (
    await db.query(
      `select u.username as rated, count(*)::int as n, avg(f.date_rating)::numeric(3,2)::text as average
         from booking_feedback f join bookings b on b.id = f.booking_id
         join users u on u.id = case when f.user_id = b.user_a then b.user_b else b.user_a end
        where not b.is_test group by u.username having avg(f.date_rating) < 3 order by avg(f.date_rating) limit 50`,
    )
  ).rows
  return { comments, reports, lowRatedDaters: dateRatings, minRatings: cfg().minRatings }
}

export async function moderateComment(req: Request, actor: AdminActor, body: Record<string, unknown>) {
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : ''
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !/^[0-9a-f-]{36}$/i.test(userId)) throw new ApiError(400, 'invalid_request', 'Send bookingId and userId.')
  const action = body.action
  if (action !== 'approve' && action !== 'hide') throw new ApiError(400, 'invalid_request', 'Action must be approve or hide.')
  const clean = typeof body.clean === 'string' ? body.clean.trim().slice(0, 500) : null
  const db = await getDb()
  const { rows } = await db.query(
    `update booking_feedback set comment_status = $3, comment_clean = $4 where booking_id = $1 and user_id = $2 returning booking_id`,
    [bookingId, userId, action === 'approve' ? 'approved' : 'hidden', action === 'approve' && clean ? clean : null],
  )
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such comment.')
  await logEvent(db, 'comment_moderated', req, actor.userId, { booking: bookingId, action })
  await audit(db, actor, req, action === 'approve' ? 'comment.approved' : 'comment.hidden', { type: 'booking', id: bookingId })
  return { ok: true }
}

export async function handleReport(req: Request, actor: AdminActor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'not_found', 'No such report.')
  const db = await getDb()
  const { rows } = await db.query<{ reporter: string; booking_id: string }>(`update booking_reports set status = 'handled', handled_at = now() where id = $1 and status = 'open' returning reporter, booking_id`, [id])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such open report.')
  await notifyDater(db, { userId: rows[0].reporter, bookingId: rows[0].booking_id, no: 0, code: 'report_handled', title: 'We looked at your report', body: 'Thank you for telling us. A person at ChoiceMi has reviewed it.' })
  await logEvent(db, 'report_handled', req, actor.userId, { report: id })
  await audit(db, actor, req, 'report.handled', { type: 'report', id })
  return { ok: true }
}

/* ---------------------------------------------------------------- dashboard */

export async function adminSummary() {
  const db = await getDb()
  const c = (
    await db.query<{ submitted: number; requested: number; stalled: number; reports: number; comments: number; no_shows7: number; late7: number }>(
      `select
         (select count(*)::int from venues where review_status = 'submitted') as submitted,
         (select count(*)::int from bookings where status = 'requested' and not is_test) as requested,
         (select count(*)::int from bookings where not is_test and ((status in ('proposed', 'picked') and deadline_at < now()) or (status = 'requested' and venue_deadline_at < now()) or (status in ('confirmed', 'partially_checked_in') and start_at < now() - interval '1 hour'))) as stalled,
         (select count(*)::int from booking_reports where status = 'open') as reports,
         (select count(*)::int from booking_feedback where comment_status = 'pending' and venue_comment <> '') as comments,
         (select count(*)::int from bookings where status = 'no_show' and not is_test and no_show_at > now() - interval '7 days') as no_shows7,
         (select count(*)::int from bookings where late_cancel and not is_test and cancelled_at > now() - interval '7 days') as late7`,
    )
  ).rows[0]
  const alerts = (await db.query(`select id, code, title, body, created_at, read_at from notifications where audience = 'admin' order by created_at desc limit 30`)).rows
  return { counts: c, alerts }
}
