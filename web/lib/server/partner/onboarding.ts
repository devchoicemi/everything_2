import { randomInt } from 'node:crypto'
import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import { logEvent } from '../auth/events'
import { partnerBaseUrl } from '../auth/config'
import { randomToken, safeEqual, sha256 } from '../auth/crypto'
import { noticeMail, sendMail } from '../auth/mailer'
import { rateLimit } from '../auth/rateLimit'
import { normalizeEmail } from '../auth/validate'
import { normalizePhone, sendSms, smsConfigured } from '../auth/sms'
import { Outbox, notifyVenue } from '../booking/notify'
import { makeQrToken, newBookingCode, newNonce, newRef } from '../booking/qr'
import { logBookingEvent } from '../booking/events'
import { todayHelsinki } from '../booking/util'
import { BOOKING_SLOTS, VENUE_TIMEZONE, parseTime } from '@/lib/booking'
import { readPick } from './places'
import { lookupYtj, normaliseBusinessId, validBusinessId } from './ytj'
import { requireOwner, type DayHours, type PartnerContext, type VenueRow } from './access'

/**
 * Getting a venue ready: the form it fills in (saved a step at a time, so nothing is lost), ChoiceMi's review,
 * and the steps between approval and going live. See "Venue onboarding" in the spec.
 */
const text = (v: unknown, max: number, field: string, { min = 0, label = field } = {}): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min || s.length > max) throw new ApiError(400, 'invalid_request', min ? `${label} must be ${min} to ${max} characters.` : `${label} must be at most ${max} characters.`, { [field]: 'Check this.' })
  return s
}

const WEEKDAYS = ['0', '1', '2', '3', '4', '5', '6']

/** Once ChoiceMi has approved a venue, who it is and where it is can only change by asking ChoiceMi. */
function assertEditable(ctx: PartnerContext, critical = false) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted') throw new ApiError(409, 'in_review', 'ChoiceMi is reviewing your application. You can edit again if we send anything back.')
  if (critical && ctx.venue.review_status === 'approved') throw new ApiError(409, 'locked', 'Ask ChoiceMi to change this: it was checked during review.')
}

/* ---------------------------------------------------------------- the view */

export interface ChecklistItem {
  key: string
  label: string
  done: boolean
  required: boolean
  /** how far along the spec's order this is: 'apply' fields, then 'review', then 'live' steps */
  stage: 'apply' | 'live'
}

export interface PhotoView {
  slot: number
  status: 'pending' | 'accepted' | 'rejected'
  rejectReason: string
  width: number
  height: number
  url: string
}

export async function onboardingView(ctx: PartnerContext, q?: Queryable) {
  const db = q ?? (await getDb())
  const v = ctx.venue
  const photos = (await db.query<{ slot: number; status: PhotoView['status']; reject_reason: string; width: number; height: number; created_at: Date }>('select slot, status, reject_reason, width, height, created_at from venue_photos where venue_id = $1 order by slot', [v.id])).rows
  const photoViews: PhotoView[] = photos.map((p) => ({ slot: p.slot, status: p.status, rejectReason: p.reject_reason, width: p.width, height: p.height, url: `/api/v1/venues/${v.id}/photos/${p.slot}?v=${new Date(p.created_at).getTime()}` }))
  const hours = v.hours ?? {}
  const hasHours = Object.values(hours).some((h) => h && h.open && h.close)
  const checklist = checklistFor(v, photos.length, hasHours)
  const missing = checklist.filter((c) => c.required && c.stage === 'apply' && !c.done).map((c) => c.label)
  return {
    venue: {
      id: v.id,
      name: v.name,
      kind: v.kind,
      area: v.area,
      description: v.description,
      businessId: v.business_id,
      ytj: v.ytj,
      location: v.place_id ? { provider: v.place_provider, placeId: v.place_id, lat: v.lat, lng: v.lng, address: v.formatted_address } : null,
      contact: { name: v.contact_name, role: v.contact_role, email: v.contact_email, emailVerified: Boolean(v.contact_email_verified_at), phone: v.booking_phone, phoneVerified: Boolean(v.booking_phone_verified_at) },
      hours,
      slotTimes: v.slot_times,
      maxPerSlot: v.capacity,
      offer: v.offer,
      stepFree: v.step_free,
      accessibleToilet: v.accessible_toilet,
      priceLevel: v.price_level,
      termsAccepted: Boolean(v.terms_accepted_at),
      photoRights: Boolean(v.photo_rights_at),
      marketingPhotos: v.marketing_photos,
      reviewStatus: v.review_status,
      review: v.review,
      submittedAt: v.submitted_at?.toISOString() ?? null,
      reviewedAt: v.reviewed_at?.toISOString() ?? null,
      deviceReady: Boolean(v.device_ready_at),
      staffBriefed: Boolean(v.staff_briefed_at),
      testDone: Boolean(v.test_done_at),
      wentLiveAt: v.went_live_at?.toISOString() ?? null,
      status: v.status,
    },
    photos: photoViews,
    checklist,
    missing,
    smsAvailable: smsConfigured() || process.env.NODE_ENV !== 'production',
  }
}

function checklistFor(v: VenueRow, photoCount: number, hasHours: boolean): ChecklistItem[] {
  const c = (key: string, label: string, done: boolean, required = true, stage: ChecklistItem['stage'] = 'apply'): ChecklistItem => ({ key, label, done, required, stage })
  return [
    c('name', 'Venue name', v.name.trim().length >= 2 && v.name !== 'My venue'),
    c('business_id', 'Business ID (Y-tunnus)', Boolean(v.business_id)),
    c('location', 'Location picked on the map', Boolean(v.place_id)),
    c('hours', 'Opening hours', hasHours),
    c('contact_email', 'Contact email, verified', Boolean(v.contact_email_verified_at)),
    c('booking_phone', 'Booking phone, verified by SMS', Boolean(v.booking_phone_verified_at)),
    c('contact_person', 'Contact person', Boolean(v.contact_name.trim() && v.contact_role.trim())),
    c('photos', 'The four photos', photoCount >= 4),
    c('slots', 'Date slots offered', v.slot_times.length > 0, false),
    c('offer', 'ChoiceMi offer', Boolean(v.offer.trim()), false),
    c('accessibility', 'Accessibility', v.step_free !== null && v.accessible_toilet !== null, false),
    c('price', 'Price level', v.price_level !== null, false),
    c('terms', 'Partner and data terms accepted', Boolean(v.terms_accepted_at && v.photo_rights_at)),
    c('approved', 'Approved by ChoiceMi', v.review_status === 'approved', true, 'live'),
    c('device', 'Check-in device set up', Boolean(v.device_ready_at), true, 'live'),
    c('staff', 'Staff briefed', Boolean(v.staff_briefed_at), true, 'live'),
    c('test', 'Test booking run', Boolean(v.test_done_at), true, 'live'),
  ]
}

/* ------------------------------------------------------------- the details */

export async function saveBasics(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  assertEditable(ctx, 'name' in body || 'businessId' in body)
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = [ctx.venue.id]
  const set = (col: string, val: unknown) => {
    params.push(val)
    sets.push(`${col} = $${params.length}`)
  }
  if ('name' in body) set('name', text(body.name, 80, 'name', { min: 2, label: 'The venue name' }))
  if ('kind' in body) set('kind', text(body.kind, 90, 'kind', { label: 'The kind of place' }))
  if ('area' in body) set('area', text(body.area, 60, 'area', { label: 'The neighbourhood' }))
  if ('description' in body) set('description', text(body.description, 600, 'description', { label: 'The description' }))
  let businessId: string | null = null
  if ('businessId' in body) {
    businessId = normaliseBusinessId(body.businessId)
    if (!businessId || !validBusinessId(businessId)) throw new ApiError(400, 'invalid_business_id', 'Enter your Business ID like 1234567-8. It is on your trade register extract.', { businessId: 'Check this.' })
    const same = await db.query('select 1 from venues where business_id = $1 and id <> $2', [businessId, ctx.venue.id])
    if (same.rows.length) throw new ApiError(409, 'business_id_taken', 'A venue with this Business ID is already on ChoiceMi. Ask its owner to invite you, or contact us.')
    set('business_id', businessId)
    set('ytj', JSON.stringify(await lookupYtj(businessId)))
    sets[sets.length - 1] += '::jsonb'
  }
  if (sets.length) await db.query(`update venues set ${sets.join(', ')} where id = $1`, params)
  await logEvent(db, 'venue_details_saved', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

async function refreshed(ctx: PartnerContext) {
  const db = await getDb()
  const venue = (await db.query<VenueRow>('select * from venues where id = $1', [ctx.venue.id])).rows[0]
  return onboardingView({ ...ctx, venue }, db)
}

export async function saveLocation(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  assertEditable(ctx, true)
  const place = readPick(body.pick)
  if (!place) throw new ApiError(400, 'pick_from_search', 'Choose your venue from the search results. The location cannot be typed in.')
  const db = await getDb()
  await db.query(
    `update venues set place_provider = $2, place_id = $3, lat = $4, lng = $5, formatted_address = $6, address = $6, city = 'Helsinki' where id = $1`,
    [ctx.venue.id, place.provider, place.placeId, place.lat, place.lng, place.address],
  )
  await logEvent(db, 'venue_location_saved', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

/* --------------------------------------------------------- hours and slots */

function parseHours(raw: unknown): Record<string, DayHours> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400, 'invalid_request', 'Send the opening hours for each weekday.')
  const out: Record<string, DayHours> = {}
  for (const day of WEEKDAYS) {
    const h = (raw as Record<string, unknown>)[day]
    if (h === null || h === undefined) continue
    const o = h as { open?: unknown; close?: unknown }
    const open = parseTime(typeof o.open === 'string' ? o.open : '')
    const close = parseTime(typeof o.close === 'string' ? o.close : '')
    if (!open || !close) throw new ApiError(400, 'invalid_hours', 'Enter opening and closing times like 10:00 and 22:00.')
    const a = open.hour * 60 + open.minute
    const b = close.hour * 60 + close.minute
    if (b <= a) throw new ApiError(400, 'invalid_hours', 'Closing time must be after opening time on the same day.')
    const pad = (n: number) => String(n).padStart(2, '0')
    out[day] = { open: `${pad(open.hour)}:${pad(open.minute)}`, close: `${pad(close.hour)}:${pad(close.minute)}` }
  }
  return out
}

export async function saveHours(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  assertEditable(ctx)
  const hours = parseHours(body.hours)
  if (Object.keys(hours).length === 0) throw new ApiError(400, 'invalid_hours', 'Choose at least one day you are open.')
  const times = body.slotTimes
  if (!Array.isArray(times) || !times.every((t) => (BOOKING_SLOTS as readonly string[]).includes(t as string))) throw new ApiError(400, 'invalid_request', 'Choose from the offered start times.', { slotTimes: 'Check this.' })
  const slotTimes = BOOKING_SLOTS.filter((t) => (times as string[]).includes(t))
  const max = body.maxPerSlot
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 20) throw new ApiError(400, 'invalid_request', 'Dates per start time must be a whole number from 1 to 20.', { maxPerSlot: 'Check this.' })
  const openDays = Object.keys(hours).map(Number).sort()
  const db = await getDb()
  await db.query('update venues set hours = $2::jsonb, open_days = $3::smallint[], slot_times = $4::text[], capacity = $5 where id = $1', [ctx.venue.id, JSON.stringify(hours), openDays, slotTimes, max])
  await logEvent(db, 'venue_hours_saved', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

/* ------------------------------------------------------------------ contact */

export async function saveContact(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted') throw new ApiError(409, 'in_review', 'ChoiceMi is reviewing your application.')
  const db = await getDb()
  const name = text(body.name, 100, 'name', { min: 2, label: 'The contact name' })
  const role = text(body.role, 80, 'role', { min: 2, label: 'The role' })
  const email = normalizeEmail(body.email)
  let phone = ctx.venue.booking_phone
  if (typeof body.phone === 'string' && body.phone.trim()) {
    const p = normalizePhone(body.phone)
    if (!p) throw new ApiError(400, 'invalid_phone', 'Use international format, like +358 40 123 4567.', { phone: 'Check this.' })
    phone = p
  }
  const emailChanged = email !== ctx.venue.contact_email
  const phoneChanged = phone !== ctx.venue.booking_phone
  await db.query(
    `update venues set contact_name = $2, contact_role = $3, contact_email = $4, booking_phone = $5, phone = $5,
            contact_email_verified_at = case when $6::boolean then null else contact_email_verified_at end,
            booking_phone_verified_at = case when $7::boolean then null else booking_phone_verified_at end
      where id = $1`,
    [ctx.venue.id, name, role, email, phone, emailChanged, phoneChanged],
  )
  await logEvent(db, 'venue_contact_saved', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

/** Emails the contact address a confirmation link. */
export async function sendContactEmailLink(req: Request, ctx: PartnerContext) {
  requireOwner(ctx)
  const email = ctx.venue.contact_email
  if (!email) throw new ApiError(409, 'no_email', 'Save your contact email first.')
  if (ctx.venue.contact_email_verified_at) return { ok: true as const, alreadyVerified: true }
  await rateLimit('venue-contact-link', ctx.venue.id, 5, 3600)
  const token = randomToken(32)
  const db = await getDb()
  await db.query(`insert into venue_contact_tokens (token_hash, venue_id, email, expires_at) values ($1, $2, $3, now() + interval '48 hours')`, [sha256(token), ctx.venue.id, email])
  const url = `${partnerBaseUrl()}/verify-contact?token=${encodeURIComponent(token)}`
  const sent = await sendMail(noticeMail(email, 'Confirm the ChoiceMi contact email for your venue', [`Confirm that ${email} is where ${ctx.venue.name} should get ChoiceMi booking alerts.`], { label: 'Confirm this email', url }, 'If you did not expect this, ignore it and nothing changes.'))
  if (!sent) throw new ApiError(503, 'mail_failed', 'We could not send the email. Please try again.')
  return { ok: true as const, alreadyVerified: false }
}

/** The link in that email. No sign-in needed: holding the link is the proof. */
export async function confirmContactEmail(token: unknown): Promise<{ ok: true; venue: string }> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw new ApiError(400, 'invalid_token', 'This link is not valid.')
  const db = await getDb()
  return db.tx(async (q) => {
    const t = (await q.query<{ venue_id: string; email: string }>(`select venue_id, email from venue_contact_tokens where token_hash = $1 and used_at is null and expires_at > now() for update`, [sha256(token)])).rows[0]
    if (!t) throw new ApiError(400, 'invalid_token', 'This link has expired or was already used. Ask for a new one in the portal.')
    await q.query('update venue_contact_tokens set used_at = now() where token_hash = $1', [sha256(token)])
    const v = (await q.query<{ name: string }>(`update venues set contact_email_verified_at = now() where id = $1 and contact_email = $2 returning name`, [t.venue_id, t.email])).rows[0]
    if (!v) throw new ApiError(400, 'invalid_token', 'The email on file has changed since this link was sent. Ask for a new one in the portal.')
    return { ok: true as const, venue: v.name }
  })
}

const newSmsCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export async function sendPhoneCode(req: Request, ctx: PartnerContext) {
  requireOwner(ctx)
  const phone = ctx.venue.booking_phone
  if (!phone) throw new ApiError(409, 'no_phone', 'Save your booking phone first.')
  if (ctx.venue.booking_phone_verified_at) return { ok: true as const, alreadyVerified: true }
  await rateLimit('venue-sms-code', ctx.venue.id, 5, 3600)
  const code = newSmsCode()
  const db = await getDb()
  await db.query(
    `insert into phone_verifications (venue_id, phone, code_hash, attempts, expires_at) values ($1, $2, $3, 0, now() + interval '10 minutes')
     on conflict (venue_id) do update set phone = excluded.phone, code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at`,
    [ctx.venue.id, phone, sha256(`${ctx.venue.id}:${code}`)],
  )
  const sent = await sendSms({ to: phone, text: `Your ChoiceMi code is ${code}. It expires in 10 minutes.` })
  if (!sent) throw new ApiError(503, 'sms_failed', 'We could not send the text message. Check the number, or try again in a moment.')
  return { ok: true as const, alreadyVerified: false }
}

export async function verifyPhoneCode(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'invalid_code', 'Enter the 6-digit code from the text message.')
  const db = await getDb()
  const r = (await db.query<{ phone: string; code_hash: string; attempts: number; expires_at: Date }>('select phone, code_hash, attempts, expires_at from phone_verifications where venue_id = $1', [ctx.venue.id])).rows[0]
  if (!r || r.phone !== ctx.venue.booking_phone || new Date(r.expires_at).getTime() < Date.now()) throw new ApiError(400, 'code_expired', 'This code has expired. Send a new one.')
  if (r.attempts >= 5) throw new ApiError(429, 'too_many_tries', 'Too many wrong codes. Send a new one.')
  if (!safeEqual(sha256(`${ctx.venue.id}:${code}`), r.code_hash)) {
    // counted outside any transaction that is about to fail, so the count is kept
    await db.query('update phone_verifications set attempts = attempts + 1 where venue_id = $1', [ctx.venue.id])
    throw new ApiError(400, 'wrong_code', 'That code is not right.')
  }
  await db.tx(async (q) => {
    await q.query('delete from phone_verifications where venue_id = $1', [ctx.venue.id])
    await q.query('update venues set booking_phone_verified_at = now() where id = $1', [ctx.venue.id])
  })
  await logEvent(db, 'venue_phone_verified', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

/* --------------------------------------------------- offer, access, terms */

export async function saveOffer(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted') throw new ApiError(409, 'in_review', 'ChoiceMi is reviewing your application.')
  const offer = text(body.offer, 120, 'offer', { label: 'The offer' })
  const bool = (v: unknown, field: string): boolean | null => {
    if (v === null || v === undefined) return null
    if (typeof v !== 'boolean') throw new ApiError(400, 'invalid_request', 'Answer yes or no.', { [field]: 'Check this.' })
    return v
  }
  const stepFree = bool(body.stepFree, 'stepFree')
  const accessibleToilet = bool(body.accessibleToilet, 'accessibleToilet')
  const price = body.priceLevel === null || body.priceLevel === undefined ? null : body.priceLevel
  if (price !== null && (typeof price !== 'number' || !Number.isInteger(price) || price < 1 || price > 3)) throw new ApiError(400, 'invalid_request', 'Choose €, €€ or €€€.', { priceLevel: 'Check this.' })
  const db = await getDb()
  await db.query('update venues set offer = $2, step_free = $3, accessible_toilet = $4, price_level = $5 where id = $1', [ctx.venue.id, offer, stepFree, accessibleToilet, price])
  await logEvent(db, 'venue_offer_saved', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

export async function acceptTerms(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  if (body.partnerTerms !== true || body.dataTerms !== true) throw new ApiError(400, 'terms_required', 'Accept the partner terms and the data-handling terms to continue.')
  if (body.photoRights !== true) throw new ApiError(400, 'photo_rights_required', 'ChoiceMi needs your permission to show your photos in the app.')
  const db = await getDb()
  await db.query('update venues set terms_accepted_at = coalesce(terms_accepted_at, now()), photo_rights_at = coalesce(photo_rights_at, now()), marketing_photos = $2 where id = $1', [ctx.venue.id, body.marketingPhotos === true])
  await logEvent(db, 'venue_terms_accepted', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

/* ------------------------------------------------------------------ submit */

export async function submitForReview(req: Request, ctx: PartnerContext) {
  requireOwner(ctx)
  if (ctx.venue.review_status === 'submitted' || ctx.venue.review_status === 'approved') throw new ApiError(409, 'already_submitted', 'This application has already been sent.')
  const view = await onboardingView(ctx)
  if (view.missing.length) throw new ApiError(409, 'incomplete', `Still to do: ${view.missing.join('; ')}.`, { missing: view.missing.join(', ') })
  const db = await getDb()
  await db.tx(async (q) => {
    await q.query(`update venues set review_status = 'submitted', submitted_at = now() where id = $1`, [ctx.venue.id])
    await q.query(`update venue_photos set status = 'pending', reject_reason = '' where venue_id = $1 and status = 'rejected'`, [ctx.venue.id])
    await q.query(
      `insert into notifications (audience, venue_id, event_no, code, title, body, channels) values ('admin', $1, 0, 'venue_submitted', $2, $3, '{admin}')`,
      [ctx.venue.id, `Venue application: ${ctx.venue.name}`, `${ctx.venue.name} sent its application for review.`],
    )
    await logEvent(q, 'venue_submitted', req, ctx.user.id, { venue: ctx.venue.id })
  })
  const admin = process.env.ADMIN_NOTIFY_EMAIL?.trim() || 'admin@choicemi.com'
  await sendMail(noticeMail(admin, `Venue application: ${ctx.venue.name}`, [`${ctx.venue.name} (${ctx.venue.business_id}) sent its application. Review it in the admin queue.`], { label: 'Open the queue', url: `${partnerBaseUrl()}/admin/venues` })).catch(() => {})
  return refreshed(ctx)
}

/* ------------------------------------------------------ device, staff, test */

export async function saveReadiness(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  if (ctx.venue.review_status !== 'approved') throw new ApiError(409, 'not_approved', 'ChoiceMi has not approved this venue yet.')
  const db = await getDb()
  if (body.deviceReady === true) await db.query('update venues set device_ready_at = coalesce(device_ready_at, now()) where id = $1', [ctx.venue.id])
  if (body.staffBriefed === true) await db.query('update venues set staff_briefed_at = coalesce(staff_briefed_at, now()) where id = $1', [ctx.venue.id])
  return refreshed(ctx)
}

const TEST_NAMES = ['Test_Guest_A', 'Test_Guest_B'] as const

/** Two stand-in guests per venue: suspended accounts that cannot sign in and never appear to members. */
async function testGuests(q: Queryable, venueId: string): Promise<[string, string]> {
  const have = (await q.query<{ test_users: string[] | null }>('select test_users from venues where id = $1', [venueId])).rows[0]?.test_users
  if (have && have.length === 2) return [have[0], have[1]]
  const ids: string[] = []
  for (const name of TEST_NAMES) {
    const suffix = randomToken(4).replace(/[^a-z0-9]/gi, '').slice(0, 4)
    const { rows } = await q.query<{ id: string }>(
      `insert into users (email, username, password_hash, role, status, terms_version, terms_accepted_at, over18_declared_at)
       values ($1, $2, 'disabled', 'tester', 'suspended', 'test', now(), now()) returning id`,
      [`test-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, '')}@test.choicemi.invalid`, `${name}_${suffix}`],
    )
    ids.push(rows[0].id)
  }
  await q.query('update venues set test_users = $2::uuid[] where id = $1', [venueId, ids])
  return [ids[0], ids[1]]
}

/** ChoiceMi sends the venue a test request. It then confirms it, scans the two test codes, and confirms the end. */
export async function startTestBooking(req: Request, ctx: PartnerContext) {
  requireOwner(ctx)
  if (ctx.venue.review_status !== 'approved') throw new ApiError(409, 'not_approved', 'ChoiceMi has not approved this venue yet.')
  const db = await getDb()
  const out = new Outbox()
  const id = await db.tx(async (q) => {
    const open = (await q.query<{ id: string }>(`select id from bookings where venue_id = $1 and is_test and status in ('requested', 'confirmed', 'partially_checked_in', 'in_progress')`, [ctx.venue.id])).rows[0]
    if (open) return open.id
    const [a, b] = await testGuests(q, ctx.venue.id)
    const [ua, ub] = a < b ? [a, b] : [b, a]
    const match = (await q.query<{ id: string }>(`insert into matches (user_a, user_b) values ($1, $2) on conflict (user_a, user_b) do update set status = 'active' returning id`, [ua, ub])).rows[0]
    const today = await todayHelsinki(q)
    const hhmm = (await q.query<{ t: string }>(`select to_char(now() at time zone $1, 'HH24:MI') as t`, [VENUE_TIMEZONE])).rows[0].t
    const ref = `${newRef()}`.replace('CM-', 'CT-')
    const code = newBookingCode()
    const row = (
      await q.query<{ id: string }>(
        `insert into bookings (ref, match_id, user_a, user_b, kind, status, window_start, window_end, venue_id, date_on, start_time, start_at, requested_at, venue_deadline_at, is_test, booking_code)
         values ($1, $2, $3, $4, 'first', 'requested', $5::date, $5::date, $6, $5::date, $7, now(), now(), now() + interval '24 hours', true, $8) returning id`,
        [ref, match.id, ua, ub, today, ctx.venue.id, hhmm, code],
      )
    ).rows[0]
    for (const uid of [ua, ub]) await q.query('insert into booking_guests (booking_id, user_id, qr_nonce) values ($1, $2, $3)', [row.id, uid, newNonce()])
    await logBookingEvent(q, row.id, 'test_requested', { actor: 'system' })
    await notifyVenue(q, out, {
      venueId: ctx.venue.id,
      bookingId: row.id,
      no: 8,
      code: 'booking_request',
      title: `TEST booking request ${ref}`,
      body: `This is a practice booking to check your setup.\nReference: ${ref}\nParty of 2: ${TEST_NAMES.join(' and ')}\n\nConfirm it in the portal, scan the two test codes, then confirm the date has ended.`,
      email: true,
      sms: true,
      cta: { label: 'Open the test request', path: '/requests' },
      smsText: `ChoiceMi TEST booking request ${ref}. Practice only: confirm it in the portal.`,
    })
    return row.id
  })
  await out.flush()
  return testBookingState(ctx, id)
}

/** Where the test run is, with the two test QR codes once the venue has confirmed. */
export async function testBookingState(ctx: PartnerContext, bookingId?: string) {
  const db = await getDb()
  const b = (
    bookingId
      ? await db.query<{ id: string; ref: string; status: string; booking_code: string | null }>(`select id, ref, status, booking_code from bookings where id = $1 and venue_id = $2 and is_test`, [bookingId, ctx.venue.id])
      : await db.query<{ id: string; ref: string; status: string; booking_code: string | null }>(`select id, ref, status, booking_code from bookings where venue_id = $1 and is_test order by created_at desc limit 1`, [ctx.venue.id])
  ).rows[0]
  if (!b) return { booking: null }
  const guests = (
    await db.query<{ user_id: string; username: string; qr_nonce: string; checked_in_at: Date | null }>(
      `select g.user_id, u.username, g.qr_nonce, g.checked_in_at from booking_guests g join users u on u.id = g.user_id where g.booking_id = $1 order by u.username`,
      [b.id],
    )
  ).rows
  const scannable = b.status === 'confirmed' || b.status === 'partially_checked_in'
  return {
    booking: {
      id: b.id,
      ref: b.ref,
      status: b.status,
      testGuests: guests.map((g) => ({ username: g.username, checkedIn: Boolean(g.checked_in_at), qr: scannable ? makeQrToken({ b: b.id, u: g.user_id, n: g.qr_nonce }) : null, bookingCode: scannable ? b.booking_code : null })),
    },
  }
}

/* ------------------------------------------------------------------ go live */

export function goLiveProblems(v: VenueRow): string[] {
  const out: string[] = []
  if (v.review_status !== 'approved') out.push('ChoiceMi has not approved your application yet.')
  if (!v.terms_accepted_at) out.push('Accept the partner terms.')
  if (!v.device_ready_at) out.push('Set up your check-in device.')
  if (!v.staff_briefed_at) out.push('Brief your staff.')
  if (!v.test_done_at) out.push('Run the test booking.')
  if (v.slot_times.length === 0) out.push('Choose at least one start time.')
  return out
}

export async function goLive(req: Request, ctx: PartnerContext) {
  requireOwner(ctx)
  const problems = goLiveProblems(ctx.venue)
  if (problems.length) throw new ApiError(409, 'not_ready', problems.join(' '))
  const db = await getDb()
  await db.query(`update venues set status = 'active', went_live_at = coalesce(went_live_at, now()) where id = $1`, [ctx.venue.id])
  await logEvent(db, 'venue_live', req, ctx.user.id, { venue: ctx.venue.id })
  return refreshed(ctx)
}

export async function pauseOrResume(req: Request, ctx: PartnerContext, body: Record<string, unknown>) {
  requireOwner(ctx)
  const want = body.status
  if (want === 'paused') {
    const db = await getDb()
    await db.query(`update venues set status = 'paused' where id = $1`, [ctx.venue.id])
    await logEvent(db, 'venue_paused', req, ctx.user.id, { venue: ctx.venue.id })
    return refreshed(ctx)
  }
  if (want === 'active') return goLive(req, ctx)
  throw new ApiError(400, 'invalid_request', 'Status must be active or paused.')
}
