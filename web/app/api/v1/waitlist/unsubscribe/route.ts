export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { unsubscribeWaitlist } from '@/lib/server/auth/waitlist'

/** Body: { email, token } from the signed link in an email. Deletes the person from the waitlist. */
export const POST = route(async (req) => {
  await unsubscribeWaitlist(req, await readJson(req))
  return json({ ok: true })
})
