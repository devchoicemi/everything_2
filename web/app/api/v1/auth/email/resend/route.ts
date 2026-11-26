export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { resendVerification } from '@/lib/server/auth/service'

export const POST = route(async (req) => {
  await resendVerification(req)
  return json({ ok: true })
})
