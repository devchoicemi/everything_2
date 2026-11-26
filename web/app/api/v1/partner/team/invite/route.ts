export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requirePartner } from '@/lib/server/partner/access'
import * as partner from '@/lib/server/partner/service'
import { pathAfter } from '@/lib/server/social/http'

/** Owner only: invite a colleague by email. */
export const POST = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner-write', ctx.user.id, 120, 3600)
  const body = await readJson(req)
  return json(await partner.inviteStaff(req, ctx, body))
})
