export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { resendLoginCode } from '@/lib/server/auth/service'

/** Sends the sign-in code again. The answer is always the same, so it reveals nothing. */
export const POST = route(async (req) => {
  await resendLoginCode(req, await readJson(req))
  return json({ ok: true })
})
