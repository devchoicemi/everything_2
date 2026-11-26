export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as users from '@/lib/server/staff/users'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'users.manage')
  const body = await readJson(req)
  return json(await users.setAccountStatus(ctx, req, pathAfter(req, 'users'), body))
})
