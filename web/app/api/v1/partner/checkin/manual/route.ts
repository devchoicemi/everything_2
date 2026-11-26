export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import * as bookings from '@/lib/server/partner/bookings'

/** Check a guest in with their username and 4-digit booking code. */
export const POST = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  requireLive(ctx)
  const body = await readJson(req)
  return json(await bookings.checkInManual(req, ctx, body))
})
