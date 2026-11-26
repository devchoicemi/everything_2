export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { clientIp } from '@/lib/server/auth/http'
import { confirmContactEmail } from '@/lib/server/partner/onboarding'

/** The link in the confirmation email. Holding the link is the proof. */
export const POST = route(async (req) => {
  await rateLimit('venue-verify-contact', clientIp(req), 30, 3600)
  const body = await readJson(req)
  return json(await confirmContactEmail(body.token))
})
