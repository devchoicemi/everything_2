export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as review from '@/lib/server/partner/review'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'moderation.manage')
  return json(await review.handleReport(req, ctx, pathAfter(req, 'report')))
})
