export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as users from '@/lib/server/staff/users'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req, 'users.read')
  return json(await users.searchUsers(new URL(req.url)))
})
