export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { unmatch } from '@/lib/server/social/matches'

export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('unmatch', user.id, 60, 3600)
  return json(await unmatch(user, pathAfter(req, 'matches')))
})
