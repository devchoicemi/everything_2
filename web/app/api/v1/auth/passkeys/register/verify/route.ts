export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { verifyRegistration } from '@/lib/server/auth/passkeys'

/** Step two of adding a passkey: check what the device signed and keep its public key. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  return json({ passkey: await verifyRegistration(req, user, await readJson(req)) }, { status: 201 })
})
