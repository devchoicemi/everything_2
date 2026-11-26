export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { confirmPicked } from '@/lib/server/booking/service'

export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('booking-act', user.id, 240, 3600)
  return json(await confirmPicked(user, pathAfter(req, 'bookings')))
})
