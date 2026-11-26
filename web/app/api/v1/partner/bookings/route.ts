export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import * as bookings from '@/lib/server/partner/bookings'

/** Bookings between two days: ?from=YYYY-MM-DD&to=YYYY-MM-DD. Guests appear by ChoiceMi username only. */
export const GET = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  requireLive(ctx)
  const url = new URL(req.url)
  return json(await bookings.bookingsBetween(ctx, url.searchParams.get('from'), url.searchParams.get('to')))
})
