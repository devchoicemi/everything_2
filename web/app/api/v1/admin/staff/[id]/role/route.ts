export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as team from '@/lib/server/staff/team'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'staff.manage')
  const body = await readJson(req)
  return json(await team.changeRole(ctx, req, pathAfter(req, 'staff'), body))
})
