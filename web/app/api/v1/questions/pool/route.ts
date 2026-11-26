export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { listPool } from '@/lib/server/questionPool'
import { POOL_THEMES } from '@/lib/questionPool'

/** The read-check question pool, with suggested answers, for members building their profile. */
export const GET = route(async (req) => {
  await requireAuth(req)
  return json({ themes: POOL_THEMES, questions: await listPool() })
})
