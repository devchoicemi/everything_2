export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as support from '@/lib/server/support/service'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req, 'support.read')
  return json(await support.ticketDetail(ctx, pathAfter(req, 'support')))
})
