export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { listMatches } from '@/lib/server/social/matches'

/** My mutual matches that are still open. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('matches', user.id, 600, 3600)
  return json({ matches: await listMatches(user) })
})
