export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { deleteAccount, describeSession, requireAuth } from '@/lib/server/auth/service'

export const GET = route(async (req) => json(describeSession((await requireAuth(req)).user)))

/** Erase my account (GDPR Art. 17). Needs the password again. */
export const DELETE = route(async (req) => json({ ok: true }, { cookies: [await deleteAccount(req, await readJson(req))] }))
