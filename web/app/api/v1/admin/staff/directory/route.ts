export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as team from '@/lib/server/staff/team'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req)
  return json(await team.directory())
})
