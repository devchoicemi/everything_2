export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { snoozePasskeyPrompt } from '@/lib/server/auth/passkeys'

/** "Not now" on the passkey suggestion: it stays away for a week. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req)
  await snoozePasskeyPrompt(req, user.id)
  return json({ ok: true })
})
