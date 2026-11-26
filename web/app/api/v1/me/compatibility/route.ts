export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { ApiError, json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { rateLimit } from '@/lib/server/auth/rateLimit'
import { getDb } from '@/lib/server/db'
import { isCompleteSet, loadCompatProfiles, saveCompatProfile } from '@/lib/server/compat/members'
import type { CompatVariableInput } from '@/lib/compat/types'

/** My saved compatibility inputs (self, ideal ratings, importance, dealbreakers) and whether they are complete. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  const profile = (await loadCompatProfiles(await getDb(), [user.id])).get(user.id)
  const variables = profile?.variables ?? []
  return json({ complete: isCompleteSet(variables), variables })
})

/** Body: { variables: CompatVariableInput[] }. Every rule in the scoring spec is enforced here, on the server. */
export const PUT = route(async (req) => {
  const { user } = await requireAuth(req)
  await rateLimit('compat-save', user.id, 120, 3600)
  const body = await readJson<{ variables?: CompatVariableInput[] }>(req)
  if (!Array.isArray(body.variables)) throw new ApiError(400, 'invalid_request', 'Send { variables: [...] }.')
  const result = await saveCompatProfile(user.id, body.variables)
  if (!result.ok) {
    const first = result.errors[0]
    const fields = Object.fromEntries(result.errors.slice(0, 20).map((e) => [e.field, e.message]))
    throw new ApiError(422, 'invalid_compatibility', `Your answers are not complete: ${first.message}`, fields)
  }
  return json({ ok: true, complete: true })
})
