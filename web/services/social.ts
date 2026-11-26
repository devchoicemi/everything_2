import { normalizeLayout } from '@/lib/profile/layouts'
import { MONTH_NAMES } from '@/lib/utils'
import type { ConnectReason, Intent, Match, Profile, Venue } from '@/types'
import type { FeedMember, MatchView, VenueView } from '@/services/members'

/**
 * Real members arrive from the server in their own shapes. The screens were built on Profile, Match
 * and DateBooking, so these adapters are the one seam between the two.
 */

const PALETTE = ['#534AB7', '#C026D3', '#A86212', '#4A42A8', '#8B3520', '#0F766E', '#B4366B', '#2F6F4E']

/** A steady colour per member, so someone looks the same everywhere. */
export function colorFor(username: string): string {
  let h = 0
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const initial = (username: string) => username.charAt(0).toUpperCase() || '?'
const asIntent = (v: string | null): Intent => (v ?? 'Serious relationship') as Intent
const datePref = (cv: FeedMember['cv']) => cv.datePrefs[0]?.value ?? ''

export function memberToProfile(m: FeedMember): Profile {
  const cv = { ...m.cv, connect: m.reasons }
  return {
    id: m.id,
    un: m.username,
    age: m.age,
    city: m.city,
    av: initial(m.username),
    avc: colorFor(m.username),
    intent: asIntent(m.intent),
    headline: m.headline,
    about: cv.about,
    ls: cv.lifestyle,
    ds: datePref(cv),
    tags: cv.interests,
    hl: m.reasons,
    ans: cv.answers,
    layout: normalizeLayout(m.layout),
    cv,
    score: m.score,
  }
}

/** Whole days from today to a YYYY-MM-DD day (0 once it has passed). */
function daysUntil(day: string | undefined): number {
  if (!day) return 0
  const [y, mo, d] = day.split('-').map(Number)
  return Math.max(0, Math.ceil((Date.UTC(y, mo - 1, d) - Date.now()) / 86_400_000))
}

export function matchToMatch(m: MatchView): Match {
  const cv = { ...m.cv, connect: m.reasons }
  return {
    id: m.id,
    memberId: m.memberId,
    un: m.username,
    age: m.age,
    city: m.city,
    av: initial(m.username),
    avc: colorFor(m.username),
    hl: m.headline,
    matched: new Date(m.matchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
    exp: daysUntil(m.window?.to),
    matchedAt: m.matchedAt,
    inMotion: !!m.openBookingStatus && m.openBookingStatus !== 'proposed',
    intent: asIntent(m.intent),
    why: m.reasons,
    ans: cv.answers,
    cv,
    score: m.score,
    layout: normalizeLayout(m.layout),
  }
}

export function venueToVenue(v: VenueView): Venue {
  return { id: v.id, n: v.name, area: v.area, type: v.kind, offer: v.offer }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "2026-03-29" to "Sun 29 March". The day is venue-local and has no time zone of its own. */
export function longDate(dateOn: string): string {
  const [y, m, d] = dateOn.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[day.getUTCDay()]} ${d} ${MONTH_NAMES[m - 1]}`
}

export type { ConnectReason }
