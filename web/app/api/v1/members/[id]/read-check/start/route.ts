export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { startReadCheck } from '@/lib/server/social/readCheck'

/** Begin (or carry on) the read-check: the same question is served until it is answered. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('readcheck-start', user.id, 300, 3600)
  return json(await startReadCheck(user, pathAfter(req, 'members')))
})
