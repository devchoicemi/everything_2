export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, json, route } from '@/lib/server/auth/http'
import { safeEqual } from '@/lib/server/auth/crypto'
import { runSweeps } from '@/lib/server/booking/sweeps'

/** Called every few minutes by cron with the TICK_SECRET. Moves bookings forward by time: reminders, expiries, day-before notices. */
export const POST = route(async (req) => {
  const secret = process.env.TICK_SECRET ?? ''
  const given = req.headers.get('x-tick-secret') ?? ''
  if (!secret || !given || !safeEqual(given, secret)) throw new ApiError(401, 'unauthorized', 'Not allowed.')
  return json(await runSweeps())
})
