export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { joinWaitlist } from '@/lib/server/auth/waitlist'

/** Public. Body: { email, consent: true, company?: honeypot, source? }. Same answer for new and existing emails. */
export const POST = route(async (req) => {
  await joinWaitlist(req, await readJson(req))
  return json({ ok: true })
})
