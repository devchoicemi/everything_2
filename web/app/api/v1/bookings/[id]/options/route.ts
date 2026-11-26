export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { parseOptionInputs, sendFirstOptions } from '@/lib/server/booking/service'

/** The first three options: a venue, a day and a time each. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('booking-act', user.id, 240, 3600)
  const body = await readJson(req)
  return json(await sendFirstOptions(user, pathAfter(req, 'bookings'), parseOptionInputs(body.options)))
})
