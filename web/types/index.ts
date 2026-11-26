import type { ProfileCV } from '@/lib/profile/cv'
/* ============================================================================
   ChoiceMi — shared domain types
   The Zustand store and services/api.ts use these shapes verbatim so a real
   backend can be wired in with no adapter layer.
   ========================================================================== */

export type Intent =
  | 'Serious relationship'
  | 'Marriage-minded'
  | 'Long-term dating'
  | 'Casual dating'

/** Generic {label, percent} shape rendered by CompatBar — used for both the
 *  compatibility engine's category breakdown and any other percent display. */
export interface CompatDimension {
  d: string
  p: number
  c?: string
}

/** Semantic key identifying which icon (see lib/connectReasonIcons.tsx) represents this reason. */
export type ConnectReasonIconKey =
  | 'chat'
  | 'coffee'
  | 'leaf'
  | 'active'
  | 'talk'
  | 'pin'
  | 'book'
  | 'walk'
  | 'curious'
  | 'serious'
  | 'family'
  | 'casual'

export interface ConnectReason {
  i: ConnectReasonIconKey
  t: string
}

export interface ProfileAnswer {
  q: string
  a: string
}

/**
 * Compatibility percentages and the read-verification gate's questions are
 * intentionally NOT part of this static shape any more — they're computed /
 * served live. See lib/compat/types.ts (CompatibilityResult, CategoryResult)
 * and lib/verification/types.ts (PublicQuestion) for those.
 */
export interface Profile {
  /** a number for the offline demo members, the member's account id for real ones */
  id: number | string
  un: string
  age: number
  city: string
  av: string
  avc: string
  intent: Intent
  headline: string
  about: string
  ls: string[]
  ds: string
  /** keyword tags for discovery/search — AI-suggested or self-picked, from a controlled vocabulary */
  tags: string[]
  hl: ConnectReason[]
  ans: ProfileAnswer[]
  /** which of the 4 profile designs this profile renders with: defaults to 'timeline' when unset */
  layout?: ProfileLayout
  /** real members: the full CV the server built, shown as it is */
  cv?: ProfileCV
  /** real members: overall compatibility with me */
  score?: number
}

export interface Match {
  /** the match's own id (a number for the offline demo) */
  id: number | string
  un: string
  age: number
  city: string
  av: string
  avc: string
  hl: string
  matched: string
  exp: number
  intent: Intent
  why: ConnectReason[]
  ans: ProfileAnswer[]
  /** real matches */
  memberId?: string
  cv?: ProfileCV
  score?: number
  layout?: ProfileLayout
  /** a date is already in motion, so there is no countdown */
  inMotion?: boolean
  /** ISO time the match was made (real matches) */
  matchedAt?: string
}

export interface Venue {
  /** real venues have an id the server knows them by */
  id?: string
  n: string
  area: string
  type: string
  offer: string
}

export type DateStatus = 'confirmed' | 'pending' | 'past'

export interface DateOffer {
  title: string
  desc: string
  /** show this at the venue to claim the offer */
  code?: string
}

export interface DateBooking {
  id: number | string
  un: string
  age: number
  av: string
  avc: string
  date: string
  time: string
  venue: string
  varea: string
  type: string
  atmo: string
  status: DateStatus
  offer: DateOffer | null
  fdone?: boolean
  /** real dates only */
  live?: LiveDate
}

export interface LiveDate {
  role: 'proposer' | 'invitee'
  matchId: string
  memberId: string
  /** YYYY-MM-DD, venue-local */
  dateOn: string
  /** HH:MM, venue-local */
  time24: string
  /** when an unanswered proposal lapses (ISO) */
  answerBy: string | null
  redateRequested: boolean
  redateMutual: boolean
}

export interface CalendarEvent {
  type: DateStatus
  label: string
  color: string
}

export interface Question {
  id: string
  q: string
  opts: string[]
}

export type QuestionDimension =
  | 'personality'
  | 'values'
  | 'lifestyle'
  | 'relationship'
  | 'future'

export interface FeedbackQuestion {
  q: string
  opts: string[]
  key: string
}

export interface SessionUser {
  username: string
  age: number
  city: string
  intent: Intent
  verified: boolean
  trustTier: number
  profileScore: number
}

/** The four CV-style profile designs (older profiles may still carry classic / editorial / minimal; see lib/profile/layouts.ts). */
export type ProfileLayout = 'timeline' | 'sidebar' | 'colorblock' | 'bloom'

export type ToastTone = 'default' | 'success' | 'danger'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
}
