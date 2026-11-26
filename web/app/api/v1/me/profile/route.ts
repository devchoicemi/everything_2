export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { json, readJson, route } from '@/lib/server/auth/http'
import { requireAuth } from '@/lib/server/auth/service'
import { getMemberProfile, saveMemberProfile } from '@/lib/server/memberProfile'

/** The signed-in member's saved profile and whether they have finished setup. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req)
  return json(await getMemberProfile(user.id))
})

/** Body: { data: { onboarding, compatDraft, aiDraft, poolPicks }, complete?: true } */
export const PUT = route(async (req) => {
  const { user } = await requireAuth(req)
  return json(await saveMemberProfile(user.id, await readJson(req)))
})
