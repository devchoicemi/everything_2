import { NextResponse } from 'next/server'
import { compatibilityScore } from '@/lib/compat/engine'
import { getUserCompatProfile } from '@/lib/compat/store'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/**
 * GET /api/compatibility/{userAId}/{userBId}
 * → { final, byCategory[], aToB: {percent, breakdown[]}, bToA: {...} }
 *
 * Pure function of both users' stored compatibility variables — safe to
 * compute on every read for the pilot's scale. The profile-reading
 * verification gate (lib/verification/*) never touches this route or its
 * inputs.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userAId: string; userBId: string }> }) {
  // (Next 15 hands params over as a promise; the offline app passes a plain object, which await also accepts)
  const params = await ctx.params
  const off = offlineOnly()
  if (off) return off
  const userA = getUserCompatProfile(params.userAId)
  const userB = getUserCompatProfile(params.userBId)

  if (!userA || !userB) {
    return NextResponse.json(
      { error: 'One or both users have not completed compatibility onboarding yet.' },
      { status: 404 },
    )
  }

  const result = compatibilityScore(userA, userB)
  return NextResponse.json(result)
}
