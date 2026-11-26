export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { startVerification } from '@/lib/server/auth/signicat'

/** Body: { returnTo?: "/onboarding?step=1" }. Returns { authorizeUrl } for the browser to open. */
export const POST = route(async (req) => {
  const auth = await requireAuth(req)
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>)
  if (auth.user.identityVerified) throw new ApiError(409, 'already_verified', 'Your identity is already verified.')
  return json(await startVerification(auth.user.id, typeof body.returnTo === 'string' ? body.returnTo : null))
})
