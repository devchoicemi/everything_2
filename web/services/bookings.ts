import { apiCall } from '@/services/auth'

/** The member's side of a booking: the same shapes the server sends (see lib/server/booking/views.ts). */
export type BookingStatus = 'proposed' | 'picked' | 'requested' | 'confirmed' | 'partially_checked_in' | 'in_progress' | 'ended' | 'declined' | 'expired' | 'closed' | 'cancelled' | 'no_show'
export type BookingAction = 'send_options' | 'pick' | 'none' | 'confirm' | 'withdraw' | 'cancel' | 'late' | 'leave' | 'no_show' | 'feedback' | 'redate' | 'report'

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

export interface BookingView {
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
  turns: { round: number; by: 'me' | 'them'; action: 'sent' | 'picked' | 'none'; reasons: string[] }[]
  picked: OptionView | null
  venue: VenueCard | null
  dateOn: string | null
  time: string | null
  startAt: string | null
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

export interface OptionInput {
  venueId: string
  dateKey: string
  time: string
}

export interface Notice {
  id: string
  no: number
  code: string
  title: string
  body: string
  bookingId: string | null
  at: string
  read: boolean
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

const enc = encodeURIComponent
const post = <T>(path: string, body: unknown = {}) => apiCall<T>(path, { method: 'POST', body })

export const bookingsApi = {
  list: () => apiCall<{ bookings: BookingSummary[] }>('/bookings'),
  get: (id: string) => apiCall<{ booking: BookingView }>(`/bookings/${enc(id)}`),
  forMatch: (matchId: string) => apiCall<{ booking: BookingView | null }>(`/matches/${enc(matchId)}/booking`),
  sendOptions: (id: string, options: OptionInput[]) => post<{ ok: true }>(`/bookings/${enc(id)}/options`, { options }),
  pick: (id: string, optionId: string) => post<{ ok: true }>(`/bookings/${enc(id)}/pick`, { optionId }),
  none: (id: string, reasons: string[], options?: OptionInput[]) => post<{ ok: true; closed: boolean }>(`/bookings/${enc(id)}/none`, { reasons, options }),
  confirm: (id: string) => post<{ ok: true }>(`/bookings/${enc(id)}/confirm`),
  withdraw: (id: string) => post<{ ok: true }>(`/bookings/${enc(id)}/withdraw`),
  cancel: (id: string) => post<{ ok: true; late: boolean }>(`/bookings/${enc(id)}/cancel`),
  late: (id: string, minutes: 10 | 15) => post<{ ok: true }>(`/bookings/${enc(id)}/late`, { minutes }),
  left: (id: string) => post<{ ok: true; ended: boolean }>(`/bookings/${enc(id)}/left`),
  noShow: (id: string) => post<{ ok: true }>(`/bookings/${enc(id)}/no-show`),
  feedback: (id: string, f: { dateRating: number; dateComment: string; venueRating: number; venueComment: string }) => post<{ ok: true }>(`/bookings/${enc(id)}/feedback`, f),
  redate: (id: string) => post<{ ok: true; mutual: boolean }>(`/bookings/${enc(id)}/redate`),
  report: (id: string, category: string, details: string) => post<{ ok: true }>(`/bookings/${enc(id)}/report`, { category, details }),

  notifications: () => apiCall<{ unread: number; notifications: Notice[] }>('/notifications'),
  markRead: () => post<{ ok: true }>('/notifications/read'),

  tickets: () => apiCall<{ tickets: Ticket[] }>('/support/tickets'),
  ticket: (id: string) => apiCall<{ ticket: { id: string; ref: string; subject: string; status: string }; messages: { id: string; author_kind: string; body: string; created_at: string }[] }>(`/support/tickets/${enc(id)}`),
  openTicket: (input: { category: string; subject: string; body: string; bookingRef?: string }) => post<{ id: string; ref: string }>('/support/tickets', input),
  replyTicket: (id: string, body: string) => post<{ ok: true }>(`/support/tickets/${enc(id)}/reply`, { body }),
}
