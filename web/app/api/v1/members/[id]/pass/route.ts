export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { passMember } from '@/lib/server/social/matches'

export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('pass', user.id, 600, 3600)
  return json(await passMember(user, pathAfter(req, 'members')))
})
