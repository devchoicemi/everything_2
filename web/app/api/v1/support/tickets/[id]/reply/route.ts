export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import * as support from '@/lib/server/support/service'

export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  const body = await readJson(req)
  return json(await support.replyAsRequester(user, pathAfter(req, 'tickets'), body))
})
