export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { requirePartner } from '@/lib/server/partner/access'
import * as partner from '@/lib/server/partner/service'
import { pathAfter } from '@/lib/server/social/http'

/** Everyone who can sign in for this venue, and pending invitations. */
export const GET = route(async (req) => {
  const ctx = await requirePartner(req)
  await rateLimit('partner', ctx.user.id, 600, 3600)
  return json(await partner.team(ctx))
})
