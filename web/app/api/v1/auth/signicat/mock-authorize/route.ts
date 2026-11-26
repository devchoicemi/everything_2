export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, redirect, route } from '@/lib/server/auth/http'
import { signicatMock } from '@/lib/server/auth/config'

/** Development stand-in for Signicat's login page: instantly "approves" and calls back. Off in production. */
export const GET = route(async (req) => {
  if (!signicatMock()) throw new ApiError(404, 'not_found', 'Not found.')
  const state = new URL(req.url).searchParams.get('state') ?? ''
  return redirect(`/api/v1/auth/signicat/callback?code=mock&state=${encodeURIComponent(state)}`)
})
