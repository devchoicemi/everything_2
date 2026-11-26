export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { likeMember } from '@/lib/server/social/matches'

/** Like a member you have read. Mutual likes become a match. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('like', user.id, 300, 3600)
  return json(await likeMember(user, pathAfter(req, 'members')))
})
