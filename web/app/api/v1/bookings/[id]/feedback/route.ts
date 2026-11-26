export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { submitBookingFeedback, validateFeedback } from '@/lib/server/booking/service'

/** After the date: two ratings (the date and the venue) and optional comments. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('booking-feedback', user.id, 60, 3600)
  const body = await readJson(req)
  return json(await submitBookingFeedback(user, pathAfter(req, 'bookings'), validateFeedback(body)))
})
