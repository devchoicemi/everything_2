export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { pathAfter } from '@/lib/server/social/http'
import { listNotifications } from '@/lib/server/booking/views'

export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('notifications', user.id, 1200, 3600)
  return json(await listNotifications(user))
})
