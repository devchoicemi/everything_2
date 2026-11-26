import { NextResponse } from 'next/server'
import { ensureLegacyDemoMatchPassed, getGateStatus } from '@/lib/verification/gate'
import { getOrCreateSessionId } from '@/lib/server/session'
import { LEGACY_MATCH_IDS } from '@/lib/mock-data'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/**
 * GET /api/verification/{targetId}/status
 * Read-only status check — does NOT start an attempt or consume anything.
 * Lets a page (e.g. the propose flow) know up front whether it's safe to
 * proceed, instead of only discovering a blocked gate after submitting.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ targetId: string }> }) {
  const off = offlineOnly()
  if (off) return off
  const params = await ctx.params
  const { id: readerId } = await getOrCreateSessionId()
  await ensureLegacyDemoMatchPassed(readerId, params.targetId, LEGACY_MATCH_IDS)
  const status = getGateStatus(readerId, params.targetId)
  return NextResponse.json({ status })
}
