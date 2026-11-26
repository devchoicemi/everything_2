export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { registrationOptions } from '@/lib/server/auth/passkeys'

/** Step one of adding a passkey: the challenge the device will sign. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  return json(await registrationOptions(req, user))
})
