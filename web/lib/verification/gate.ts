import { mutateTable, readTable } from '@/lib/server/jsonStore'
import { resolveGateBank } from './bankStore'
import type { AnswerResult, AttemptSession, AttemptStatus, GateQuestion, PublicQuestion, StartResult } from './types'

/**
 * Server-side profile-reading verification gate.
 *
 * Documented reset policy (the spec left this open — see
 * docs/VERIFICATION_GATE_POLICY.md for the full rationale):
 *   - A session is keyed by (readerId, targetProfileId) and lives entirely
 *     server-side, so a page refresh cannot reset attempt count or reroll a
 *     served question — `startAttempt` returns the *same* in-flight question
 *     until it is answered.
 *   - 3 wrong answers blocks that (reader, target) pair for 24 hours
 *     (matching the existing product copy "come back tomorrow"). After the
 *     cooldown, the next `startAttempt` call transparently resets the
 *     session and serves a fresh random question.
 *   - A wrong answer serves another *eligible* question — one not yet asked
 *     in this session, falling back to the full bank if every question has
 *     already been used.
 *
 * All mutations go through `mutateTable`, which serialises writes to this
 * table through one promise chain — the guard against two concurrent
 * `answerAttempt` calls double-counting or racing past the attempt cap.
 */

const TABLE = 'verification_attempts'
export const MAX_ATTEMPTS = 3
export const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000

type AttemptsTable = Record<string, AttemptSession>

export class VerificationConfigError extends Error {}

function key(readerId: string, targetId: string) {
  return `${readerId}:${targetId}`
}

function toPublic(q: GateQuestion): PublicQuestion {
  return { questionId: q.id, question: q.question, options: q.options }
}

function pickEligibleQuestion(
  questions: GateQuestion[],
  excludeIds: string[],
  rng: () => number,
): GateQuestion {
  const pool = questions.filter((q) => !excludeIds.includes(q.id))
  const candidates = pool.length ? pool : questions
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
  return candidates[idx]
}

export async function startAttempt(
  readerId: string,
  targetId: string,
  rng: () => number = Math.random,
): Promise<StartResult> {
  const bank = resolveGateBank(targetId)
  if (!bank || bank.questions.length === 0) {
    throw new VerificationConfigError(`No verification questions configured for profile "${targetId}"`)
  }

  let result!: StartResult

  await mutateTable<AttemptsTable>(TABLE, {}, (table) => {
    const k = key(readerId, targetId)
    const now = Date.now()
    let session = table[k]

    if (session?.status === 'blocked' && session.blockedUntil !== null) {
      if (now < session.blockedUntil) {
        result = {
          status: 'blocked',
          attemptsUsed: session.attemptsUsed,
          attemptsRemaining: 0,
          question: null,
          blockedUntil: session.blockedUntil,
        }
        return table
      }
      // cooldown elapsed — fall through to a fresh session below
      session = undefined as unknown as AttemptSession
    }

    if (session?.status === 'passed') {
      result = {
        status: 'passed',
        attemptsUsed: session.attemptsUsed,
        attemptsRemaining: MAX_ATTEMPTS - session.attemptsUsed,
        question: null,
        blockedUntil: null,
      }
      return table
    }

    if (session?.status === 'active' && session.currentQuestionId) {
      const q = bank.questions.find((x) => x.id === session.currentQuestionId)
      if (q) {
        result = {
          status: 'active',
          attemptsUsed: session.attemptsUsed,
          attemptsRemaining: MAX_ATTEMPTS - session.attemptsUsed,
          question: toPublic(q),
          blockedUntil: null,
        }
        return table
      }
    }

    const question = pickEligibleQuestion(bank.questions, [], rng)
    const fresh: AttemptSession = {
      readerId,
      targetId,
      status: 'active',
      attemptsUsed: 0,
      askedQuestionIds: [question.id],
      currentQuestionId: question.id,
      blockedUntil: null,
      passedAt: null,
      updatedAt: now,
    }
    table[k] = fresh
    result = {
      status: 'active',
      attemptsUsed: 0,
      attemptsRemaining: MAX_ATTEMPTS,
      question: toPublic(question),
      blockedUntil: null,
    }
    return table
  })

  return result
}

export async function answerAttempt(
  readerId: string,
  targetId: string,
  questionId: string,
  selectedOption: string,
  rng: () => number = Math.random,
): Promise<AnswerResult> {
  const bank = resolveGateBank(targetId)
  if (!bank) {
    throw new VerificationConfigError(`No verification questions configured for profile "${targetId}"`)
  }

  let result!: AnswerResult

  await mutateTable<AttemptsTable>(TABLE, {}, (table) => {
    const k = key(readerId, targetId)
    const now = Date.now()
    const session = table[k]

    if (!session || session.status !== 'active') {
      result = {
        correct: false,
        status: session?.status ?? 'active',
        attemptsUsed: session?.attemptsUsed ?? 0,
        attemptsRemaining: session ? MAX_ATTEMPTS - session.attemptsUsed : MAX_ATTEMPTS,
        nextQuestion: null,
        blockedUntil: session?.blockedUntil ?? null,
        feedback:
          session?.status === 'blocked'
            ? 'This read-check is temporarily locked.'
            : session?.status === 'passed'
              ? 'You already passed this read-check.'
              : 'Start a read-check before answering.',
      }
      return table
    }

    if (session.currentQuestionId !== questionId) {
      const current = bank.questions.find((q) => q.id === session.currentQuestionId)
      result = {
        correct: false,
        status: 'active',
        attemptsUsed: session.attemptsUsed,
        attemptsRemaining: MAX_ATTEMPTS - session.attemptsUsed,
        nextQuestion: current ? toPublic(current) : null,
        blockedUntil: null,
        feedback: 'That question is no longer active — answer the current one shown.',
      }
      return table
    }

    const question = bank.questions.find((q) => q.id === questionId)!
    const correct = question.correctAnswer === selectedOption

    if (correct) {
      session.status = 'passed'
      session.passedAt = now
      session.currentQuestionId = null
      session.updatedAt = now
      table[k] = session
      result = {
        correct: true,
        status: 'passed',
        attemptsUsed: session.attemptsUsed,
        attemptsRemaining: MAX_ATTEMPTS - session.attemptsUsed,
        nextQuestion: null,
        blockedUntil: null,
        feedback: 'Correct — well done for reading carefully.',
      }
      return table
    }

    session.attemptsUsed += 1

    if (session.attemptsUsed >= MAX_ATTEMPTS) {
      session.status = 'blocked'
      session.blockedUntil = now + BLOCK_DURATION_MS
      session.currentQuestionId = null
      session.updatedAt = now
      table[k] = session
      result = {
        correct: false,
        status: 'blocked',
        attemptsUsed: session.attemptsUsed,
        attemptsRemaining: 0,
        nextQuestion: null,
        blockedUntil: session.blockedUntil,
        feedback: 'Three attempts used. Take a break and come back in 24 hours.',
      }
      return table
    }

    const nextQuestion = pickEligibleQuestion(bank.questions, session.askedQuestionIds, rng)
    session.askedQuestionIds.push(nextQuestion.id)
    session.currentQuestionId = nextQuestion.id
    session.updatedAt = now
    table[k] = session
    const remaining = MAX_ATTEMPTS - session.attemptsUsed
    result = {
      correct: false,
      status: 'active',
      attemptsUsed: session.attemptsUsed,
      attemptsRemaining: remaining,
      nextQuestion: toPublic(nextQuestion),
      blockedUntil: null,
      feedback: `Not quite — the answer is in the profile. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
    }
    return table
  })

  return result
}

/** Used server-side by the propose route — the gate a page refresh can't bypass. */
export function hasPassedGate(readerId: string, targetId: string): boolean {
  const table = readTable<AttemptsTable>(TABLE, {})
  return table[key(readerId, targetId)]?.status === 'passed'
}

export function getGateStatus(readerId: string, targetId: string): AttemptStatus | 'none' {
  const table = readTable<AttemptsTable>(TABLE, {})
  return table[key(readerId, targetId)]?.status ?? 'none'
}

/**
 * Bridges pre-seeded demo matches (lib/mock-data.ts MATCHES — mutual matches
 * that exist in the pilot's seed data, from before this session's gate
 * existed) into the real, server-enforced gate: the first time one is
 * touched, it is recorded as passed so `hasPassedGate` is genuinely true
 * going forward, rather than special-cased forever. This is intentionally
 * narrow — it only recognises the fixed ids passed in, never a general
 * bypass, and every other profile must pass the real question/answer gate.
 */
export async function ensureLegacyDemoMatchPassed(
  readerId: string,
  targetId: string,
  legacyMatchIds: readonly string[],
): Promise<void> {
  if (!legacyMatchIds.includes(targetId)) return
  await mutateTable<AttemptsTable>(TABLE, {}, (table) => {
    const k = key(readerId, targetId)
    if (table[k]?.status === 'passed') return table
    const now = Date.now()
    table[k] = {
      readerId,
      targetId,
      status: 'passed',
      attemptsUsed: 0,
      askedQuestionIds: [],
      currentQuestionId: null,
      blockedUntil: null,
      passedAt: now,
      updatedAt: now,
    }
    return table
  })
}

/** Test-only direct session read. */
export function __getSessionForTests(readerId: string, targetId: string): AttemptSession | undefined {
  const table = readTable<AttemptsTable>(TABLE, {})
  return table[key(readerId, targetId)]
}
