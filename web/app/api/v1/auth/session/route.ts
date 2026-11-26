export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { describeSession, getAuth } from '@/lib/server/auth/service'
import { listPasskeys, shouldSuggestPasskey } from '@/lib/server/auth/passkeys'
import { isTestAccount, loginOtpEnabled } from '@/lib/server/auth/otp'
import { mailConfigured, mailProvider, requirements, signicatConfigured, signicatMock, signupMode, appLaunched } from '@/lib/server/auth/config'

/** Who is signed in, what is still required of them, and which connectors are live. */
export const GET = route(async (req) => {
  const auth = await getAuth(req)
  const config = {
    identityProvider: signicatMock() ? 'mock' : signicatConfigured() ? 'signicat' : null,
    emailDelivery: mailConfigured(),
    emailProvider: mailProvider(),
    signupMode: signupMode(),
    launched: appLaunched(),
  }
  if (!auth) return json({ authenticated: false, requirements: requirements(), config })
  // test accounts have made-up emails and never see codes or passkey prompts
  const exempt = isTestAccount(auth.user.role)
  const passkeys = exempt ? 0 : (await listPasskeys(auth.user.id)).length
  const security = { exempt, loginCode: !exempt && loginOtpEnabled(), passkeys, suggestPasskey: await shouldSuggestPasskey(auth.user) }
  return json({ ...describeSession(auth.user), config, security })
})
