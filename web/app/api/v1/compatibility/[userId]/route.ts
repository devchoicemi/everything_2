export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { compatibilityWith } from '@/lib/server/compat/discover'

/**
 * How compatible am I with this member? (Spec section 10.) Returns the final percentage, the
 * per-category percentages, how MY ratings scored them variable by variable, and how THEIR ratings
 * scored me as a percentage only. Their individual ratings are never revealed.
 */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('compat-read', user.id, 600, 3600)
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
  return json(await compatibilityWith(user, id))
})
