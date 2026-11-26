export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { logOut } from '@/lib/server/auth/service'

export const POST = route(async (req) => json({ ok: true }, { cookies: [await logOut(req, { all: true })] }))
