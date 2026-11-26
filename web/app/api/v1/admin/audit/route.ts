export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import { listAudit } from '@/lib/server/staff/audit'

export const GET = route(async (req) => {
  const ctx = await requireStaff(req, 'audit.read')
  return json(await listAudit(new URL(req.url)))
})
