import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import { logEvent } from '../auth/events'
import { createInvite } from '../auth/waitlist'
import { INVITE_TTL_DAYS } from '../auth/config'
import { partnerInviteMail, sendMail } from '../auth/mailer'
import { rateLimit } from '../auth/rateLimit'
import { normalizeEmail } from '../auth/validate'
import { cfg } from '../booking/config'
import { addDays, todayHelsinki } from '../booking/util'
import { BOOKING_SLOTS, VENUE_TIMEZONE } from '@/lib/booking'
import { requireOwner, type PartnerContext } from './access'
import { goLiveProblems } from './onboarding'

/* ------------------------------------------------------------------ helpers */

const str = (v: unknown, max: number, field: string): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length > max) throw new ApiError(400, 'invalid_request', `${field} must be at most ${max} characters.`, { [field]: 'Check this.' })
  return s
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
function realDate(v: unknown, field = 'date'): string {
  if (typeof v !== 'string' || !DAY.test(v)) throw new ApiError(400, 'invalid_date', `Choose a real ${field}.`)
  const [y, m, d] = v.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) throw new ApiError(400, 'invalid_date', `Choose a real ${field}.`)
  return v
}

const UUID = /^[0-9a-f-]{36}$/i

export interface VenueSummary {
  id: string
  name: string
  area: string
  status: 'pending' | 'active' | 'paused'
  reviewStatus: 'draft' | 'submitted' | 'sent_back' | 'approved'
}

/** Who I am, which venue I manage, and how far along it is. The portal uses this to decide what to show. */
export function me(ctx: PartnerContext) {
  const v = ctx.venue
  return {
    email: ctx.user.email,
    staffRole: ctx.staffRole,
    venue: { id: v.id, name: v.name, area: v.area, status: v.status, reviewStatus: v.review_status } satisfies VenueSummary,
    goLiveProblems: v.status === 'active' ? [] : goLiveProblems(v),
  }
}

/* ------------------------------------------------------------ availability */

export interface Closure {
  id: string
  dateOn: string
  /** null = the whole day */
  startTime: string | null
  endTime: string | null
  reason: string
}

async function listClosures(q: Queryable, venueId: string): Promise<Closure[]> {
  const { rows } = await q.query<{ id: string; date_on: string; start_time: string | null; end_time: string | null; reason: string }>(
    `select id, to_char(date_on, 'YYYY-MM-DD') as date_on, start_time, end_time, reason from venue_closures
      where venue_id = $1 and date_on >= (now() at time zone $2)::date order by date_on, start_time nulls first`,
    [venueId, VENUE_TIMEZONE],
  )
  return rows.map((r) => ({ id: r.id, dateOn: r.date_on, startTime: r.start_time, endTime: r.end_time, reason: r.reason }))
}

export async function availability(ctx: PartnerContext) {
  const db = await getDb()
  const v = ctx.venue
  return { hours: v.hours, slotTimes: v.slot_times, maxPerSlot: v.capacity, closures: await listClosures(db, v.id), slots: BOOKING_SLOTS }
}

/** An exception to the opening hours: a whole day, or from one time to another (holidays, private events). */
export async function addClosure(req: Request, ctx: PartnerContext, body: Record<string, unknown>): Promise<{ closure: Closure; existingBookings: number }> {
  requireOwner(ctx)
  const dateOn = realDate(body.dateOn, 'day')
  const clean = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v))
  const startTime = clean(body.startTime)
  const endTime = clean(body.endTime)
  if (startTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new ApiError(400, 'invalid_request', 'Enter the start of the closure like 14:00, or leave it empty for the whole day.')
  if (endTime !== null && (startTime === null || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime)) throw new ApiError(400, 'invalid_request', 'The end of the closure must be after its start.')
  const reason = str(body.reason ?? '', 120, 'reason')
  const db = await getDb()
  const today = await todayHelsinki(db)
  if (dateOn < today) throw new ApiError(400, 'invalid_date', 'Choose today or a later day.')
  if (dateOn > addDays(today, 366)) throw new ApiError(400, 'invalid_date', 'Choose a day within the next year.')
  let row
  try {
    row = (await db.query<{ id: string }>('insert into venue_closures (venue_id, date_on, start_time, end_time, reason) values ($1, $2::date, $3, $4, $5) returning id', [ctx.venue.id, dateOn, startTime, endTime, reason])).rows[0]
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'already_closed', 'That is already marked as closed.')
    throw e
  }
  // bookings already made for that time stay; tell the owner so they can call them off
  const existing = await db.query<{ n: number }>(
    `select count(*)::int as n from bookings where venue_id = $1 and date_on = $2::date and status in ('requested', 'confirmed')
        and ($3::text is null or (start_time >= $3 and ($4::text is null or start_time < $4)))`,
    [ctx.venue.id, dateOn, startTime, endTime],
  )
  await logEvent(db, 'venue_closure_added', req, ctx.user.id, { venue: ctx.venue.id, dateOn, startTime })
  return { closure: { id: row.id, dateOn, startTime, endTime, reason }, existingBookings: existing.rows[0].n }
}

export async function removeClosure(req: Request, ctx: PartnerContext, id: string): Promise<{ ok: true }> {
  requireOwner(ctx)
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such closure.')
  const db = await getDb()
  const { rows } = await db.query('delete from venue_closures where id = $1 and venue_id = $2 returning id', [id, ctx.venue.id])
  if (!rows[0]) throw new ApiError(404, 'not_found', 'No such closure.')
  await logEvent(db, 'venue_closure_removed', req, ctx.user.id, { venue: ctx.venue.id })
  return { ok: true }
}

/* ----------------------------------------------------------------- insights */

/**
 * The venue's own numbers. Ratings follow the privacy rules: an average appears only after a minimum number
 * of ratings, and comments are shown only once ChoiceMi has checked them, with no dates or usernames.
 */
export async function stats(ctx: PartnerContext) {
  const db = await getDb()
  const v = ctx.venue.id
  const c = cfg()
  const totals = (
    await db.query<{ upcoming: number; hosted30: number; no_show30: number; offers30: number; cancelled30: number; hosted_all: number; requested: number }>(
      `select
         count(*) filter (where status = 'confirmed' and start_at > now())::int as upcoming,
         count(*) filter (where status = 'ended' and start_at > now() - interval '30 days')::int as hosted30,
         count(*) filter (where status = 'no_show' and start_at > now() - interval '30 days')::int as no_show30,
         count(*) filter (where offer_claimed_at is not null and start_at > now() - interval '30 days')::int as offers30,
         count(*) filter (where status = 'cancelled' and confirmed_at is not null and start_at > now() - interval '30 days')::int as cancelled30,
         count(*) filter (where status = 'ended')::int as hosted_all,
         count(*) filter (where status = 'requested')::int as requested
       from bookings where venue_id = $1 and not is_test`,
      [v],
    )
  ).rows[0]
  const weeks = await db.query<{ week: string; hosted: number; booked: number }>(
    `select to_char(date_trunc('week', date_on), 'YYYY-MM-DD') as week,
            count(*) filter (where status = 'ended')::int as hosted,
            count(*) filter (where status in ('confirmed', 'partially_checked_in', 'in_progress', 'ended'))::int as booked
       from bookings
      where venue_id = $1 and not is_test and date_on >= (date_trunc('week', now()) - interval '7 weeks')::date and date_on < (date_trunc('week', now()) + interval '1 week')::date
      group by 1 order by 1`,
    [v],
  )
  const rating = (
    await db.query<{ n: number; avg: string | null }>(`select count(*)::int as n, avg(f.venue_rating)::numeric(3,2)::text as avg from booking_feedback f join bookings b on b.id = f.booking_id where b.venue_id = $1 and not b.is_test`, [v])
  ).rows[0]
  const enough = rating.n >= c.minRatings
  const comments = enough
    ? (
        await db.query<{ comment: string }>(
          `select coalesce(f.comment_clean, f.venue_comment) as comment from booking_feedback f join bookings b on b.id = f.booking_id
            where b.venue_id = $1 and not b.is_test and f.comment_status = 'approved' and f.venue_comment <> '' order by md5(f.booking_id::text || f.user_id::text) limit 30`,
          [v],
        )
      ).rows.map((r) => r.comment)
    : []
  return {
    upcoming: totals.upcoming,
    awaitingAnswer: totals.requested,
    last30: { hosted: totals.hosted30, noShows: totals.no_show30, offersClaimed: totals.offers30, cancelled: totals.cancelled30 },
    hostedAllTime: totals.hosted_all,
    weekly: weeks.rows,
    ratings: { count: rating.n, needed: c.minRatings, average: enough && rating.avg ? Number(rating.avg) : null, comments },
  }
}

/* --------------------------------------------------------------------- team */

export async function team(ctx: PartnerContext) {
  const db = await getDb()
  const { rows } = await db.query<{ id: string; email: string; role: 'owner' | 'staff'; last_login_at: Date | null; created_at: Date }>(
    `select u.id, u.email, s.role, u.last_login_at, s.created_at from venue_staff s join users u on u.id = s.user_id where s.venue_id = $1 order by s.created_at`,
    [ctx.venue.id],
  )
  const pending = await db.query<{ email: string; expires_at: Date }>(
    `select email, expires_at from invites where venue_id = $1 and role = 'partner' and used_at is null and expires_at > now() order by created_at`,
    [ctx.venue.id],
  )
  return {
    members: rows.map((r) => ({ id: r.id, email: r.email, role: r.role, lastSignIn: r.last_login_at?.toISOString() ?? null, you: r.id === ctx.user.id })),
    invited: pending.rows.map((r) => ({ email: r.email, expiresAt: r.expires_at.toISOString() })),
  }
}

export async function inviteStaff(req: Request, ctx: PartnerContext, body: Record<string, unknown>): Promise<{ ok: true }> {
  requireOwner(ctx)
  await rateLimit('partner-invite', ctx.venue.id, 10, 3600)
  const email = normalizeEmail(body.email)
  const db = await getDb()
  const taken = await db.query('select 1 from users where email = $1', [email])
  if (taken.rows.length) throw new ApiError(409, 'email_taken', 'That email already has a ChoiceMi account.')
  const token = await db.tx((q) => createInvite(q, email, { role: 'partner', venueId: ctx.venue.id }))
  const sent = await sendMail(partnerInviteMail(email, token, ctx.venue.name, INVITE_TTL_DAYS))
  if (!sent) throw new ApiError(503, 'mail_failed', 'We could not send the invitation. Please try again.')
  await logEvent(db, 'venue_staff_invited', req, ctx.user.id, { venue: ctx.venue.id })
  return { ok: true }
}

export async function removeStaff(req: Request, ctx: PartnerContext, userId: string): Promise<{ ok: true }> {
  requireOwner(ctx)
  if (!UUID.test(userId)) throw new ApiError(404, 'not_found', 'No such team member.')
  if (userId === ctx.user.id) throw new ApiError(400, 'invalid_request', 'You cannot remove yourself.')
  const db = await getDb()
  await db.tx(async (q) => {
    const { rows } = await q.query<{ role: string }>('delete from venue_staff where user_id = $1 and venue_id = $2 returning role', [userId, ctx.venue.id])
    if (!rows[0]) throw new ApiError(404, 'not_found', 'No such team member.')
    // their sign-in is for this venue only: end it, so they cannot get back in
    await q.query(`update users set status = 'suspended' where id = $1 and role = 'partner' and not exists (select 1 from venue_staff where user_id = $1)`, [userId])
    await q.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [userId])
    await logEvent(q, 'venue_staff_removed', req, ctx.user.id, { venue: ctx.venue.id })
  })
  return { ok: true }
}
