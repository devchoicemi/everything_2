export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAdmin } from '@/lib/server/auth/admin'
import * as apps from '@/lib/server/partner/applications'

/** Admin. { venueName, email, area?, address?, city?, phone? }: set up a venue you agreed with directly. */
export const POST = route(async (req) => {
  await requireAdmin(req)
  return json(await apps.createPartner(req, await readJson(req)), { status: 201 })
})
