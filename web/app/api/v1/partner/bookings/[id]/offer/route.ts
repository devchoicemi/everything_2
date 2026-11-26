export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import * as bookings from '@/lib/server/partner/bookings'

/** The ChoiceMi offer has been given. */
export const POST = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  requireLive(ctx)
  return json(await bookings.claimOffer(req, ctx, pathAfter(req, 'bookings')))
})
