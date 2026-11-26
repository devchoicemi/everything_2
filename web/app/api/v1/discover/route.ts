export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { feedFor } from '@/lib/server/compat/discover'

/** Members I could meet, best compatibility first, with their CV profile. Orientation has to suit both people. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('discover', user.id, 300, 3600)
  return json({ members: await feedFor(user) })
})
