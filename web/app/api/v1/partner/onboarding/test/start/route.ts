export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import * as onb from '@/lib/server/partner/onboarding'

/** Send the venue a practice booking request. */
export const POST = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  requireLive(ctx)
  return json(await onb.startTestBooking(req, ctx))
})
