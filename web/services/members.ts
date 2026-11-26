import { apiCall } from '@/services/auth'
import type { CategoryResult, VariableBreakdown } from '@/lib/compat/types'
import type { ProfileCV } from '@/lib/profile/cv'
import type { AnswerResult, AttemptStatus, StartResult } from '@/lib/verification/types'
import type { ConnectReason } from '@/types'

export interface FeedMember {
  id: string
  username: string
  age: number
  city: string
  intent: string | null
  headline: string
  reasons: ConnectReason[]
  /** overall compatibility, 0-100 */
  score: number
  byCategory: CategoryResult[]
  cv: ProfileCV
  layout: string
}

export interface PairCompatibility {
  final: number
  byCategory: CategoryResult[]
  you: { percent: number; breakdown: VariableBreakdown[] }
  them: { percent: number }
  member: { id: string; username: string }
}

export interface MatchView {
  id: string
  memberId: string
  username: string
  age: number
  city: string
  intent: string | null
  headline: string
  matchedAt: string
  /** the date window, first day to last day, while the match is being planned */
  window: { from: string; to: string } | null
  reasons: ConnectReason[]
  score: number
  byCategory: CategoryResult[]
  cv: ProfileCV
  layout: string
  openBookingId: string | null
  openBookingStatus: string | null
}

export interface VenueView {
  id: string
  name: string
  area: string
  kind: string
  offer: string
  address: string
}

export interface SlotView {
  time: string
  label: string
  available: boolean
  reason?: string
}

const enc = encodeURIComponent

/** Real members, scored against me by the server's compatibility engine; likes, matches and venues. */
export const membersApi = {
  feed: () => apiCall<{ members: FeedMember[] }>('/discover'),
  compatibility: (id: string) => apiCall<PairCompatibility>(`/compatibility/${enc(id)}`),

  readCheckStart: (id: string) => apiCall<StartResult>(`/members/${enc(id)}/read-check/start`, { method: 'POST', body: {} }),
  readCheckAnswer: (id: string, questionId: string, selectedOption: string) =>
    apiCall<AnswerResult>(`/members/${enc(id)}/read-check/answer`, { method: 'POST', body: { questionId, selectedOption } }),
  readCheckStatus: (id: string) => apiCall<{ status: AttemptStatus | 'none' }>(`/members/${enc(id)}/read-check`),

  like: (id: string) => apiCall<{ mutual: boolean; matchId: string | null; score: number }>(`/members/${enc(id)}/like`, { method: 'POST', body: {} }),
  pass: (id: string) => apiCall<{ ok: true }>(`/members/${enc(id)}/pass`, { method: 'POST', body: {} }),

  matches: () => apiCall<{ matches: MatchView[] }>('/matches'),
  match: (id: string) => apiCall<{ match: MatchView }>(`/matches/${enc(id)}`),
  unmatch: (id: string) => apiCall<{ ok: true }>(`/matches/${enc(id)}/unmatch`, { method: 'POST', body: {} }),

  venues: () => apiCall<{ venues: VenueView[] }>('/venues'),
  slots: (venueId: string, dateKey: string) => apiCall<{ slots: SlotView[] }>(`/venues/${enc(venueId)}/slots?date=${enc(dateKey)}`),
}
