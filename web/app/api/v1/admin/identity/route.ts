export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { lookupIdentity, requireAdmin } from '@/lib/server/auth/admin'

/** Admin / security only. GET ?email=... returns the verified identity record, including the decrypted legal name. Audited. */
export const GET = route(async (req) => {
  await requireAdmin(req)
  return json(await lookupIdentity(req, new URL(req.url)))
})
