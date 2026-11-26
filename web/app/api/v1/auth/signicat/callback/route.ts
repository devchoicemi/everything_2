export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { redirect, route } from '@/lib/server/auth/http'
import { getAuth } from '@/lib/server/auth/service'
import { completeVerification } from '@/lib/server/auth/signicat'

/** Signicat sends the browser back here with ?code&state (or ?error). We finish up and land on /verify/result. */
export const GET = route(async (req) => {
  const url = new URL(req.url)
  const auth = await getAuth(req)
  if (!auth) return redirect('/login?next=/verify')
  const result = await completeVerification(
    req,
    { code: url.searchParams.get('code'), state: url.searchParams.get('state'), error: url.searchParams.get('error') },
    auth.user.id,
  )
  const q = new URLSearchParams({ status: result.ok ? 'ok' : 'failed', next: result.returnTo })
  if (!result.ok) q.set('reason', result.reason)
  return redirect(`/verify/result?${q}`)
})
