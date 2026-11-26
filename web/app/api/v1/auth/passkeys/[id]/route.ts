export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { removePasskey } from '@/lib/server/auth/passkeys'

export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req)
  const id = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
  await removePasskey(req, user.id, decodeURIComponent(id))
  return json({ ok: true })
})
