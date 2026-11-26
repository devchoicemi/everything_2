export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { completeLogin, describeSession } from '@/lib/server/auth/service'

/** Step two of signing in: the 6-digit code from the email. */
export const POST = route(async (req) => {
  const { user, cookie } = await completeLogin(req, await readJson(req))
  return json(describeSession(user), { cookies: [cookie] })
})
