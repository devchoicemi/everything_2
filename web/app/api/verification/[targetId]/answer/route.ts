import { NextResponse } from 'next/server'
import { answerAttempt, VerificationConfigError } from '@/lib/verification/gate'
import { getOrCreateSessionId } from '@/lib/server/session'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/**
 * POST /api/verification/{targetId}/answer  { questionId, selectedOption }
 * Validates the answer against the server-stored correct answer — the
 * client never sees or checks correctness itself.
 */
export async function POST(req: Request, ctx: { params: Promise<{ targetId: string }> }) {
  const off = offlineOnly()
  if (off) return off
  const params = await ctx.params
  const { id: readerId } = await getOrCreateSessionId()

  let body: { questionId?: string; selectedOption?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.questionId || typeof body.selectedOption !== 'string') {
    return NextResponse.json({ error: '"questionId" and "selectedOption" are required' }, { status: 400 })
  }

  try {
    const result = await answerAttempt(readerId, params.targetId, body.questionId, body.selectedOption)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof VerificationConfigError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    throw err
  }
}
