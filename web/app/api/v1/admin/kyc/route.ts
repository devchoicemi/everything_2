export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import * as kyc from '@/lib/server/staff/kyc'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req, 'kyc.read')
  return json(await kyc.kycQueue(new URL(req.url)))
})
