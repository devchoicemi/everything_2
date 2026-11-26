export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { bookingForMatch } from '@/lib/server/booking/views'

export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('bookings', user.id, 600, 3600)
  return json(await bookingForMatch(user, pathAfter(req, 'matches')))
})
