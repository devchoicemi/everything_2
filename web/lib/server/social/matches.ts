import { getDb } from '../db'
import { ApiError } from '../auth/http'
import type { PublicUser } from '../auth/service'
import {
  ageFrom,
  assertCanBrowse,
  cardFor,
  loadVisibleMember,
  pairResult,
  reasonsFrom,
  type StoredData,
} from '../compat/discover'
import { loadCompleteProfile } from '../compat/members'
import { hasPassed } from './readCheck'
import { createBooking } from '../booking/service'
import { STATUS_LIVE, type BookingStatus } from '../booking/config'
import { setStatus } from '../booking/events'
import { notifyVenue, Outbox } from '../booking/notify'
import type { CategoryResult } from '@/lib/compat/types'
import type { ProfileCV } from '@/lib/profile/cv'
import type { ConnectReason } from '@/types'

export interface MatchView {
  id: string
  memberId: string
  username: string
  age: number
  city: string
  intent: string | null
  headline: string
  matchedAt: string
  /** the date window, first day to last day (YYYY-MM-DD), while the match is still being planned */
  window: { from: string; to: string } | null
  reasons: ConnectReason[]
  score: number
  byCategory: CategoryResult[]
  cv: ProfileCV
  layout: string
  /** the live booking on this match, if any */
  openBookingId: string | null
  openBookingStatus: string | null
}

interface MatchRow {
  id: string
  user_a: string
  user_b: string
  created_at: Date
  other_id: string
  other_username: string
  other_data: StoredData
  open_booking: string | null
  open_status: string | null
  window_start: string | null
  window_end: string | null
}

const BASE_SQL = `
  select m.id, m.user_a, m.user_b, m.created_at,
         o.id as other_id, o.username as other_username, mp.data as other_data,
         lb.id as open_booking, lb.status as open_status,
         to_char(lb.window_start, 'YYYY-MM-DD') as window_start, to_char(lb.window_end, 'YYYY-MM-DD') as window_end
    from matches m
    join users o on o.id = case when m.user_a = $1 then m.user_b else m.user_a end
    join member_profiles mp on mp.user_id = o.id
    left join lateral (
      select id, status, window_start, window_end from bookings
       where match_id = m.id and status in ('proposed', 'picked', 'requested', 'confirmed', 'partially_checked_in', 'in_progress')
       limit 1
    ) lb on true
   where (m.user_a = $1 or m.user_b = $1)
     and m.status = 'active'
     and o.status = 'active'`

async function toViews(viewer: PublicUser, rows: MatchRow[]): Promise<MatchView[]> {
  const db = await getDb()
  const mine = await loadCompleteProfile(db, viewer.id)
  const out: MatchView[] = []
  for (const r of rows) {
    const theirs = await loadCompleteProfile(db, r.other_id)
    if (!mine || !theirs) continue
    const pair = pairResult(mine, theirs)
    const card = cardFor(r.other_username, r.other_data)
    const ob = r.other_data.onboarding ?? {}
    out.push({
      id: r.id,
      memberId: r.other_id,
      username: r.other_username,
      age: ageFrom(theirs),
      city: String(ob.city ?? ''),
      intent: typeof ob.intent === 'string' ? ob.intent : null,
      headline: String(ob.headline ?? ''),
      matchedAt: new Date(r.created_at).toISOString(),
      window: r.window_start && r.window_end ? { from: r.window_start, to: r.window_end } : null,
      reasons: reasonsFrom(pair.byCategory),
      score: Math.round(pair.final),
      byCategory: pair.byCategory,
      cv: card.cv,
      layout: card.layout,
      openBookingId: r.open_booking,
      openBookingStatus: r.open_status,
    })
  }
  return out
}

export async function listMatches(viewer: PublicUser): Promise<MatchView[]> {
  assertCanBrowse(viewer)
  const db = await getDb()
  const { rows } = await db.query<MatchRow>(`${BASE_SQL} order by m.created_at desc`, [viewer.id])
  return toViews(viewer, rows)
}

export async function getMatch(viewer: PublicUser, matchId: string): Promise<MatchView> {
  assertCanBrowse(viewer)
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) throw new ApiError(404, 'not_found', 'No such match.')
  const db = await getDb()
  const { rows } = await db.query<MatchRow>(`${BASE_SQL} and m.id = $2`, [viewer.id, matchId])
  const views = await toViews(viewer, rows)
  if (!views[0]) throw new ApiError(404, 'not_found', 'No such match.')
  return views[0]
}

export interface LikeResult {
  mutual: boolean
  matchId: string | null
  /** overall compatibility, for the "It's a match" moment */
  score: number
}

/** Like someone you have read. A like only counts after the read-check is passed. */
export async function likeMember(viewer: PublicUser, targetId: string): Promise<LikeResult> {
  const target = await loadVisibleMember(viewer, targetId)
  const db = await getDb()
  if (!(await hasPassed(db, viewer.id, targetId))) {
    throw new ApiError(403, 'read_check_required', 'Read their profile and pass the read-check before you like them.')
  }
  const mine = await loadCompleteProfile(db, viewer.id)
  if (!mine) throw new ApiError(409, 'profile_incomplete', 'Finish your compatibility answers first.')
  const score = Math.round(pairResult(mine, target.compat).final)

  return db.tx(async (q) => {
    const existing = (await q.query<{ kind: string }>('select kind from reactions where from_user = $1 and to_user = $2', [viewer.id, targetId])).rows[0]
    if (existing?.kind === 'pass') throw new ApiError(409, 'already_passed', 'You passed on this member.')
    if (!existing) await q.query(`insert into reactions (from_user, to_user, kind) values ($1, $2, 'like')`, [viewer.id, targetId])

    const [a, b] = viewer.id < targetId ? [viewer.id, targetId] : [targetId, viewer.id]
    const found = (await q.query<{ id: string }>('select id from matches where user_a = $1 and user_b = $2', [a, b])).rows[0]
    if (found) return { mutual: true, matchId: found.id, score }

    const back = await q.query(`select 1 from reactions where from_user = $1 and to_user = $2 and kind = 'like'`, [targetId, viewer.id])
    if (back.rows.length === 0) return { mutual: false, matchId: null, score }

    const created = await q.query<{ id: string }>(
      `insert into matches (user_a, user_b) values ($1, $2)
       on conflict (user_a, user_b) do update set user_a = matches.user_a returning id`,
      [a, b],
    )
    // the match starts the date planning: the window opens and both people are told (notification 1)
    await createBooking(q, created.rows[0].id)
    return { mutual: true, matchId: created.rows[0].id, score }
  })
}

export async function passMember(viewer: PublicUser, targetId: string): Promise<{ ok: true }> {
  await loadVisibleMember(viewer, targetId)
  const db = await getDb()
  await db.query(`insert into reactions (from_user, to_user, kind) values ($1, $2, 'pass') on conflict (from_user, to_user) do nothing`, [viewer.id, targetId])
  return { ok: true }
}

/** End a match. Any live booking on it is cancelled with it, and the venue is told if it had already been asked. */
export async function unmatch(viewer: PublicUser, matchId: string): Promise<{ ok: true }> {
  assertCanBrowse(viewer)
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) throw new ApiError(404, 'not_found', 'No such match.')
  const db = await getDb()
  const out = new Outbox()
  await db.tx(async (q) => {
    const m = (await q.query<{ id: string }>(`select id from matches where id = $1 and (user_a = $2 or user_b = $2) and status = 'active' for update`, [matchId, viewer.id])).rows[0]
    if (!m) throw new ApiError(404, 'not_found', 'No such match.')
    await q.query(`update matches set status = 'unmatched' where id = $1`, [matchId])
    const live = await q.query<{ id: string; status: BookingStatus; venue_id: string | null; ref: string; user_a: string; user_b: string; date_on: string | null; start_time: string | null }>(
      `select id, status, venue_id, ref, user_a, user_b, to_char(date_on, 'YYYY-MM-DD') as date_on, start_time from bookings where match_id = $1 and status = any($2::text[]) for update`,
      [matchId, [...STATUS_LIVE]],
    )
    for (const b of live.rows) {
      if (b.status === 'in_progress' || b.status === 'partially_checked_in') continue // a date under way carries on
      const was = b.status
      await setStatus(q, b, 'cancelled', 'unmatched', { type: 'dater', id: viewer.id }, {}, { cancelled_at: new Date(), cancelled_by: viewer.id, cancelled_role: 'dater', deadline_at: null, turn_user: null })
      if ((was === 'requested' || was === 'confirmed') && b.venue_id && b.date_on && b.start_time) {
        await notifyVenue(q, out, { venueId: b.venue_id, bookingId: b.id, no: 19, code: 'booking_cancelled', title: `Booking ${b.ref} was cancelled`, body: `A guest cancelled booking ${b.ref}.`, email: true, sms: true, smsText: `ChoiceMi: booking ${b.ref} was cancelled.` })
      }
    }
  })
  await out.flush()
  return { ok: true }
}
