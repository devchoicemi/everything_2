export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { changePassword } from '@/lib/server/auth/service'

export const POST = route(async (req) => {
  await changePassword(req, await readJson(req))
  return json({ ok: true })
})
