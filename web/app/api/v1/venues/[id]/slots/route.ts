export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { slotsFor } from '@/lib/server/booking/views'

/** Which of the 12:00-19:00 start times are free at this venue on a day (?date=YYYY-MM-DD). */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('venues', user.id, 600, 3600)
  const date = new URL(req.url).searchParams.get('date')
  if (!date) throw new ApiError(400, 'invalid_request', 'date is required.')
  return json({ slots: await slotsFor(pathAfter(req, 'venues'), date) })
})
