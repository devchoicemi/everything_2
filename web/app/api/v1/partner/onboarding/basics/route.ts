export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requireLive, requirePartner } from '@/lib/server/partner/access'
import { pathAfter } from '@/lib/server/social/http'
import * as onb from '@/lib/server/partner/onboarding'

/** Venue name, kind, neighbourhood, description, Business ID. */
export const PUT = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 900, 3600)
  const body = await readJson(req)
  return json(await onb.saveBasics(req, ctx, body))
})
