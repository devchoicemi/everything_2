export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { listPasskeys } from '@/lib/server/auth/passkeys'

/** The passkeys I have added. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  return json({ passkeys: await listPasskeys(user.id) })
})
