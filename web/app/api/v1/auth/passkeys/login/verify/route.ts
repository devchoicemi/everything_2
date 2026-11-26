export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { describeSession, logInWithPasskey } from '@/lib/server/auth/service'
import { verifyLogin } from '@/lib/server/auth/passkeys'

/** Step two: check the device's signed answer and sign in. A passkey is two factors, so no emailed code. */
export const POST = route(async (req) => {
  const userId = await verifyLogin(req, await readJson(req))
  const { user, cookie } = await logInWithPasskey(req, userId)
  return json(describeSession(user), { cookies: [cookie] })
})
