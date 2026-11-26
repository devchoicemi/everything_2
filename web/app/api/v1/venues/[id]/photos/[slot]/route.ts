export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, route } from '@/lib/server/auth/http'
import { getDb } from '@/lib/server/db'
import { requireAuth } from '@/lib/server/auth/service'
import { parseSlot, readPhoto } from '@/lib/server/partner/photos'
import { pathAfter } from '@/lib/server/social/http'

/** A venue photo. Approved photos are for anyone signed in; others only for the venue's staff and ChoiceMi. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  const venueId = pathAfter(req, 'venues')
  const slot = parseSlot(pathAfter(req, 'photos'))
  const db = await getDb()
  const staff = user.role === 'partner' ? (await db.query('select 1 from venue_staff where user_id = $1 and venue_id = $2', [user.id, venueId])).rows.length > 0 : false
  const photo = await readPhoto(venueId, slot, { staffOfVenue: staff, admin: user.role === 'admin' })
  if (!photo) throw new ApiError(404, 'not_found', 'No such photo.')
  return new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': photo.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } })
})
