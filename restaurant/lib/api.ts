/** Calls the ChoiceMi API (/api/v1/...) on this same address. Cookies carry the sign-in. */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined && !init.form ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError('Could not reach ChoiceMi. Check your connection and try again.', 'network', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; fields?: Record<string, string> } }).error ?? {}
    throw new ApiError(e.message ?? 'Something went wrong. Please try again.', e.code ?? 'error', res.status, e.fields)
  }
  return data as T
}

export const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

/* ----------------------------------- types ---------------------------------- */

export interface SessionUser {
  id: string
  email: string
  role: 'member' | 'partner' | 'admin' | 'tester'
  emailVerified: boolean
}

export interface SessionState {
  authenticated: boolean
  user?: SessionUser
  next?: 'verify_email' | 'verify_identity' | 'prelaunch' | 'continue'
}

export type VenueStatus = 'pending' | 'active' | 'paused'
export type ReviewStatus = 'draft' | 'submitted' | 'sent_back' | 'approved'

export interface Me {
  email: string
  staffRole: 'owner' | 'staff'
  venue: { id: string; name: string; area: string; status: VenueStatus; reviewStatus: ReviewStatus }
  goLiveProblems: string[]
}

export type BookingStatus = 'proposed' | 'picked' | 'requested' | 'confirmed' | 'partially_checked_in' | 'in_progress' | 'ended' | 'declined' | 'expired' | 'closed' | 'cancelled' | 'no_show'

export interface Guest {
  username: string
  checkedInAt: string | null
  checkedInVia: 'qr' | 'manual' | null
  leftAt: string | null
  lateNote: number | null
}

export interface VenueBooking {
  id: string
  ref: string
  status: BookingStatus
  dateOn: string
  time: string
  startAt: string
  guests: Guest[]
  requestedAt: string | null
  answerBy: string | null
  confirmedAt: string | null
  startedAt: string | null
  endedAt: string | null
  offerClaimedAt: string | null
  guestLeft: boolean
  cancelledRole: 'dater' | 'venue' | 'system' | null
}

export interface DayHours {
  open: string
  close: string
}

export interface Onboarding {
  venue: {
    id: string
    name: string
    kind: string
    area: string
    description: string
    businessId: string | null
    ytj: { found: boolean; name?: string; status?: string; unavailable?: boolean } | null
    location: { provider: string; placeId: string; lat: number; lng: number; address: string } | null
    contact: { name: string; role: string; email: string; emailVerified: boolean; phone: string; phoneVerified: boolean }
    hours: Record<string, DayHours>
    slotTimes: string[]
    maxPerSlot: number
    offer: string
    stepFree: boolean | null
    accessibleToilet: boolean | null
    priceLevel: number | null
    termsAccepted: boolean
    photoRights: boolean
    marketingPhotos: boolean
    reviewStatus: ReviewStatus
    review: { items?: Record<string, { ok: boolean; reason?: string }>; note?: string }
    submittedAt: string | null
    reviewedAt: string | null
    deviceReady: boolean
    staffBriefed: boolean
    testDone: boolean
    wentLiveAt: string | null
    status: VenueStatus
  }
  photos: { slot: number; status: 'pending' | 'accepted' | 'rejected'; rejectReason: string; width: number; height: number; url: string }[]
  checklist: { key: string; label: string; done: boolean; required: boolean; stage: 'apply' | 'live' }[]
  missing: string[]
  smsAvailable: boolean
}

export interface Place {
  provider: 'google' | 'osm'
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  pick: string
}

export interface Closure {
  id: string
  dateOn: string
  startTime: string | null
  endTime: string | null
  reason: string
}

export interface Stats {
  upcoming: number
  awaitingAnswer: number
  last30: { hosted: number; noShows: number; offersClaimed: number; cancelled: number }
  hostedAllTime: number
  weekly: { week: string; hosted: number; booked: number }[]
  ratings: { count: number; needed: number; average: number | null; comments: string[] }
}

export interface TeamResponse {
  members: { id: string; email: string; role: 'owner' | 'staff'; lastSignIn: string | null; you: boolean }[]
  invited: { email: string; expiresAt: string }[]
}

export interface CheckInResult {
  booking: VenueBooking
  username: string
  started: boolean
}

export interface Alert {
  id: string
  no: number
  code: string
  title: string
  body: string
  at: string
  read: boolean
  bookingId: string | null
}

export interface Ticket {
  id: string
  ref: string
  subject: string
  category: string
  status: string
  last_activity_at: string
  unseen_replies: number
}
