export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requirePartner } from '@/lib/server/partner/access'
import * as partner from '@/lib/server/partner/service'
import { pathAfter } from '@/lib/server/social/http'

/** Owner only: remove a colleague. */
export const DELETE = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner-write', ctx.user.id, 120, 3600)
  const id = pathAfter(req, 'team')
  return json(await partner.removeStaff(req, ctx, id))
})
