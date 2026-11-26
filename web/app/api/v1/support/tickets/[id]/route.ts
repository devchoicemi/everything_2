export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import * as support from '@/lib/server/support/service'

export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('support', user.id, 600, 3600)
  return json(await support.myTicket(user, pathAfter(req, 'tickets')))
})
