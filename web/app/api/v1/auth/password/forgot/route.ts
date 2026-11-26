export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { forgotPassword } from '@/lib/server/auth/service'

/** Same answer whether or not the email has an account. */
export const POST = route(async (req) => {
  await forgotPassword(req, await readJson(req))
  return json({ ok: true })
})
