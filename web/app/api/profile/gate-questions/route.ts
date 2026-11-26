import { NextResponse } from 'next/server'
import { resolveGateBank, saveGateBank, type GateQuestionInput } from '@/lib/verification/bankStore'
import { getOrCreateSessionId } from '@/lib/server/session'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/** GET → the current session's read-check questions (correct answers stripped). */
export async function GET() {
  const off = offlineOnly()
  if (off) return off
  const { id } = await getOrCreateSessionId()
  const bank = resolveGateBank(id)
  const questions = (bank?.questions ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }))
  return NextResponse.json({ questions })
}

/** POST { questions: {question, correctAnswer, distractors[2-3]}[4-5] } — owner-authored read-check bank. */
export async function POST(req: Request) {
  const off = offlineOnly()
  if (off) return off
  const { id } = await getOrCreateSessionId()

  let body: { questions?: GateQuestionInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.questions)) {
    return NextResponse.json({ error: '"questions" must be an array' }, { status: 400 })
  }

  const result = await saveGateBank(id, body.questions)
  if (!result.ok) {
    return NextResponse.json({ error: 'Validation failed', details: result.errors }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}
