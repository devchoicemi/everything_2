export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { describeSession, logIn } from '@/lib/server/auth/service'

/**
 * Step one of signing in. With a correct password the answer is either a signed-in session, or
 * `{ otpRequired: true, challenge, emailHint }` when a code has been emailed (answer it at /auth/login/verify).
 */
export const POST = route(async (req) => {
  const result = await logIn(req, await readJson(req))
  if (result.kind === 'otp') return json({ otpRequired: true, challenge: result.challenge, emailHint: result.emailHint })
  return json(describeSession(result.user), { cookies: [result.cookie] })
})
