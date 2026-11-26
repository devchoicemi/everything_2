import { getDb } from '../db'
import { ApiError } from '../auth/http'
import { requireAuth, type PublicUser } from '../auth/service'

/**
 * Who may use the restaurant portal. A partner account belongs to a venue through `venue_staff`.
 * Everyone from the venue can see bookings and check guests in; only the owner changes settings,
 * opening times and the team.
 */
export interface DayHours {
  open: string
  close: string
}

export interface VenueRow {
  id: string
  name: string
  area: string
  kind: string
  offer: string
  description: string
  address: string
  city: string
  phone: string
  website: string
  status: 'pending' | 'active' | 'paused'
  capacity: number
  open_days: number[]
  slot_times: string[]
  hours: Record<string, DayHours>
  business_id: string | null
  ytj: Record<string, unknown> | null
  place_provider: string | null
  place_id: string | null
  lat: number | null
  lng: number | null
  formatted_address: string | null
  contact_name: string
  contact_role: string
  contact_email: string
  contact_email_verified_at: Date | null
  booking_phone: string
  booking_phone_verified_at: Date | null
  step_free: boolean | null
  accessible_toilet: boolean | null
  price_level: number | null
  review_status: 'draft' | 'submitted' | 'sent_back' | 'approved'
  review: Record<string, unknown>
  submitted_at: Date | null
  reviewed_at: Date | null
  terms_accepted_at: Date | null
  photo_rights_at: Date | null
  marketing_photos: boolean
  device_ready_at: Date | null
  staff_briefed_at: Date | null
  test_done_at: Date | null
  went_live_at: Date | null
}

export interface PartnerContext {
  user: PublicUser
  venue: VenueRow
  staffRole: 'owner' | 'staff'
}

export async function loadVenue(id: string): Promise<VenueRow> {
  const db = await getDb()
  const row = (await db.query<VenueRow>('select * from venues where id = $1', [id])).rows[0]
  if (!row) throw new ApiError(404, 'not_found', 'No such venue.')
  return row
}

export async function requirePartner(req: Request): Promise<PartnerContext> {
  const { user } = await requireAuth(req)
  if (user.role !== 'partner') throw new ApiError(403, 'not_partner', 'This is for restaurant partners.')
  if (!user.emailVerified) throw new ApiError(403, 'email_unverified', 'Confirm your email first.')
  const db = await getDb()
  const wanted = new URL(req.url).searchParams.get('venue')
  const { rows } = await db.query<VenueRow & { staff_role: 'owner' | 'staff' }>(
    `select v.*, s.role as staff_role
       from venue_staff s join venues v on v.id = s.venue_id
      where s.user_id = $1 order by (v.id = $2) desc, s.created_at`,
    [user.id, wanted ?? ''],
  )
  const row = rows[0]
  if (!row) throw new ApiError(403, 'no_venue', 'Your account is not linked to a venue yet. Contact ChoiceMi.')
  const { staff_role, ...venue } = row
  // the owner already proved their own email when they signed up: the same address needs no second link
  if (!venue.contact_email_verified_at && venue.contact_email && venue.contact_email.toLowerCase() === user.email.toLowerCase()) {
    venue.contact_email_verified_at = new Date()
    await db.query('update venues set contact_email_verified_at = now() where id = $1 and contact_email_verified_at is null', [venue.id])
  }
  return { user, venue, staffRole: staff_role }
}

/** Live venues only: the check-in, requests and bookings screens. Draft and under-review venues get the onboarding screens instead. */
export function requireLive(ctx: PartnerContext): void {
  if (ctx.venue.review_status !== 'approved') throw new ApiError(409, 'not_approved', 'ChoiceMi has not approved this venue yet.')
}

export function requireOwner(ctx: PartnerContext): void {
  if (ctx.staffRole !== 'owner') throw new ApiError(403, 'owner_only', 'Only the venue owner can change this.')
}
