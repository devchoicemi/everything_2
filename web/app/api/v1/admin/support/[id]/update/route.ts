export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as support from '@/lib/server/support/service'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'support.reply')
  const body = await readJson(req)
  return json(await support.updateTicket(ctx, req, pathAfter(req, 'support'), body))
})
