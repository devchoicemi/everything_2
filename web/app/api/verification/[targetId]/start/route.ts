import { NextResponse } from 'next/server'
import { startAttempt, VerificationConfigError } from '@/lib/verification/gate'
import { getOrCreateSessionId } from '@/lib/server/session'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/**
 * POST /api/verification/{targetId}/start
 * Server-side, cookie-identified reader — refreshing the page and calling
 * this again returns the *same* in-progress question/attempt count rather
 * than a fresh one, which is what makes the gate refresh-proof.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ targetId: string }> }) {
  const off = offlineOnly()
  if (off) return off
  const params = await ctx.params
  const { id: readerId } = await getOrCreateSessionId()
  try {
    const result = await startAttempt(readerId, params.targetId)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof VerificationConfigError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    throw err
  }
}
