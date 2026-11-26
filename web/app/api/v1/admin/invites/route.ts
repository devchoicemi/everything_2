export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { inviteBatch, requireAdmin } from '@/lib/server/auth/admin'

/**
 * Admin. Bearer ADMIN_TOKEN. Body: { limit?, emails?, allowDirect?, dryRun? }.
 * Emails one-time invitation links to the oldest people still waiting (or the given emails).
 */
export const POST = route(async (req) => {
  await requireAdmin(req)
  return json(await inviteBatch(req, await readJson(req).catch(() => ({}))))
})
