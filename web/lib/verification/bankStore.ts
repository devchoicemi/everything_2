import { mutateTable, readTable } from '@/lib/server/jsonStore'
import { getGateBank as getSeedBank } from './bank'
import { validateGateQuestions, type GateQuestionInput } from './validate'
import type { GateQuestion, ProfileGateBank } from './types'

/**
 * Lets a real (session-identified) user author their own 4-5 read-check
 * questions during onboarding, per the requirement ("profiles should
 * contain approximately four to five owner-supplied questions and correct
 * answers"). Falls back to the seeded demo bank (lib/verification/bank.ts)
 * for the pilot's fixed cast of demo profiles until they have their own.
 *
 * Server-only (imports the fs-backed jsonStore) — client code should import
 * validateGateQuestions from ./validate instead.
 */

const TABLE = 'verification_banks'
type StoredTable = Record<string, GateQuestion[]>

export function resolveGateBank(profileId: string): ProfileGateBank | undefined {
  const table = readTable<StoredTable>(TABLE, {})
  if (table[profileId]?.length) return { profileId, questions: table[profileId] }
  return getSeedBank(profileId)
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function saveGateBank(
  profileId: string,
  qs: GateQuestionInput[],
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors = validateGateQuestions(qs)
  if (errors.length) return { ok: false, errors }

  const questions: GateQuestion[] = qs.map((q, i) => {
    const correctAnswer = q.correctAnswer.trim()
    const distractors = q.distractors.map((d) => d.trim()).filter(Boolean)
    return {
      id: `${profileId}-u${i + 1}`,
      question: q.question.trim(),
      correctAnswer,
      options: shuffle([correctAnswer, ...distractors]),
    }
  })

  await mutateTable<StoredTable>(TABLE, {}, (table) => {
    table[profileId] = questions
    return table
  })
  return { ok: true }
}

export type { GateQuestionInput } from './validate'
