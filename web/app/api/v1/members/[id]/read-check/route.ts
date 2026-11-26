export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { readCheckStatus } from '@/lib/server/social/readCheck'

/** Where am I with the read-check for this member? */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('readcheck-read', user.id, 600, 3600)
  return json(await readCheckStatus(user, pathAfter(req, 'members')))
})
