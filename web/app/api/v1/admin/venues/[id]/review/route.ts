export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as review from '@/lib/server/partner/review'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'venues.review')
  const body = await readJson(req)
  return json(await review.decideReview(req, ctx, pathAfter(req, 'venues'), body))
})
