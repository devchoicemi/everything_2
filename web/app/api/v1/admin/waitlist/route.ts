export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { listWaitlist, requireAdmin } from '@/lib/server/auth/admin'

/** Admin. GET ?status=waiting|invited|joined&limit&offset returns counts and entries. Bearer ADMIN_TOKEN. */
export const GET = route(async (req) => {
  await requireAdmin(req)
  return json(await listWaitlist(new URL(req.url)))
})
