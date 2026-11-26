export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireStaff } from '@/lib/server/staff/access'
import { pathAfter } from '@/lib/server/social/http'
import { describeStaff } from '@/lib/server/staff/access'

/** Who is signed in to the staff site, and what their role allows. */
export const GET = route(async (req) => {
  const ctx = await requireStaff(req)
  return json(describeStaff(ctx))
})
