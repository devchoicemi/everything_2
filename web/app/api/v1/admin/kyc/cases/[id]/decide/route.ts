export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as kyc from '@/lib/server/staff/kyc'

export const POST = route(async (req) => {
  const ctx = await requireStaff(req, 'kyc.decide')
  const body = await readJson(req)
  return json(await kyc.decide(ctx, req, pathAfter(req, 'cases'), body))
})
