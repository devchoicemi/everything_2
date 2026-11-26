export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, route } from '@/lib/server/auth/http'
import { checkInvite } from '@/lib/server/auth/waitlist'

/** GET ?token=... returns { valid, email? } so the sign-up page can prefill the invited address. */
export const GET = route(async (req) => json(await checkInvite(req, new URL(req.url).searchParams.get('token'))))
