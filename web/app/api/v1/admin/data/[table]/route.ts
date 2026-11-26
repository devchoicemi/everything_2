export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as data from '@/lib/server/staff/data'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req, 'data.read')
  return json(await data.browseTable(ctx, req, pathAfter(req, 'data'), new URL(req.url)))
})
