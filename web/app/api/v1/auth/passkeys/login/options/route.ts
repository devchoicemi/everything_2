export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { loginOptions } from '@/lib/server/auth/passkeys'

/** Step one of signing in with a passkey (no account needed yet: the device offers its passkeys). */
export const POST = route(async (req) => json(await loginOptions(req)))
