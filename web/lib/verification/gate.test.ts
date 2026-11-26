import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStoreForTests } from '@/lib/server/jsonStore'
import { getGateBank } from './bank'
import {
  __getSessionForTests,
  answerAttempt,
  BLOCK_DURATION_MS,
  hasPassedGate,
  MAX_ATTEMPTS,
  startAttempt,
} from './gate'

const TARGET = '1' // Maple_Dusk — has a 5-question seeded bank
const READER = 'reader-1'
const zeroRng = () => 0 // deterministic: always picks the first eligible candidate

const bank = getGateBank(TARGET)!
const firstQuestion = bank.questions[0]
const wrongAnswerFor = (correct: string, options: string[]) => options.find((o) => o !== correct)!

beforeEach(() => {
  __resetStoreForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startAttempt', () => {
  it('serves a question from the profile\'s own bank', async () => {
    const res = await startAttempt(READER, TARGET, zeroRng)
    expect(res.status).toBe('active')
    expect(res.attemptsUsed).toBe(0)
    expect(res.attemptsRemaining).toBe(MAX_ATTEMPTS)
    expect(bank.questions.map((q) => q.id)).toContain(res.question!.questionId)
    // the correct answer is never shipped to the client
    expect(res.question).not.toHaveProperty('correctAnswer')
  })
})

describe('answerAttempt — correct answer', () => {
  it('passes the gate and hasPassedGate becomes true', async () => {
    await startAttempt(READER, TARGET, zeroRng)
    expect(hasPassedGate(READER, TARGET)).toBe(false)

    const res = await answerAttempt(READER, TARGET, firstQuestion.id, firstQuestion.correctAnswer)
    expect(res.correct).toBe(true)
    expect(res.status).toBe('passed')
    expect(hasPassedGate(READER, TARGET)).toBe(true)
  })
})

describe('answerAttempt — wrong answers, retries, exhaustion', () => {
  it('a wrong answer decrements remaining attempts and serves another eligible question', async () => {
    const start = await startAttempt(READER, TARGET, zeroRng)
    const q1 = start.question!
    const bankQ1 = bank.questions.find((q) => q.id === q1.questionId)!
    const wrong = wrongAnswerFor(bankQ1.correctAnswer, q1.options)

    const res = await answerAttempt(READER, TARGET, q1.questionId, wrong)
    expect(res.correct).toBe(false)
    expect(res.status).toBe('active')
    expect(res.attemptsUsed).toBe(1)
    expect(res.attemptsRemaining).toBe(MAX_ATTEMPTS - 1)
    expect(res.nextQuestion).not.toBeNull()
    expect(res.nextQuestion!.questionId).not.toBe(q1.questionId)
  })

  it('three wrong answers in a row block the session for 24 hours', async () => {
    let question = (await startAttempt(READER, TARGET, zeroRng)).question!

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const bankQ = bank.questions.find((q) => q.id === question.questionId)!
      const wrong = wrongAnswerFor(bankQ.correctAnswer, question.options)
      const res = await answerAttempt(READER, TARGET, question.questionId, wrong)

      if (attempt < MAX_ATTEMPTS) {
        expect(res.status).toBe('active')
        expect(res.attemptsUsed).toBe(attempt)
        question = res.nextQuestion!
      } else {
        expect(res.status).toBe('blocked')
        expect(res.attemptsUsed).toBe(MAX_ATTEMPTS)
        expect(res.attemptsRemaining).toBe(0)
        expect(res.blockedUntil).toBeGreaterThan(Date.now())
        expect(res.blockedUntil).toBeLessThanOrEqual(Date.now() + BLOCK_DURATION_MS + 1000)
      }
    }

    expect(hasPassedGate(READER, TARGET)).toBe(false)
  })
})

describe('page refresh cannot bypass or reroll the gate', () => {
  it('re-calling start after one wrong answer returns the SAME in-flight question and attempt count', async () => {
    const first = await startAttempt(READER, TARGET, zeroRng)
    const bankQ = bank.questions.find((q) => q.id === first.question!.questionId)!
    const wrong = wrongAnswerFor(bankQ.correctAnswer, first.question!.options)
    const afterWrong = await answerAttempt(READER, TARGET, first.question!.questionId, wrong)

    // simulate a page refresh: the client calls /start again
    const refreshed = await startAttempt(READER, TARGET, zeroRng)

    expect(refreshed.status).toBe('active')
    expect(refreshed.attemptsUsed).toBe(1) // NOT reset to 0
    expect(refreshed.question!.questionId).toBe(afterWrong.nextQuestion!.questionId) // NOT rerolled
  })

  it('refreshing while blocked still reports blocked, with the same cooldown', async () => {
    let question = (await startAttempt(READER, TARGET, zeroRng)).question!
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const bankQ = bank.questions.find((q) => q.id === question.questionId)!
      const wrong = wrongAnswerFor(bankQ.correctAnswer, question.options)
      const res = await answerAttempt(READER, TARGET, question.questionId, wrong)
      if (res.nextQuestion) question = res.nextQuestion
    }

    const beforeRefresh = __getSessionForTests(READER, TARGET)!
    expect(beforeRefresh.status).toBe('blocked')

    const refreshed = await startAttempt(READER, TARGET, zeroRng)
    expect(refreshed.status).toBe('blocked')
    expect(refreshed.blockedUntil).toBe(beforeRefresh.blockedUntil) // not extended/reset by the refresh
  })
})

describe('documented reset policy: 24h cooldown', () => {
  it('a fresh start after the cooldown elapses resets attempts and serves a new question', async () => {
    let question = (await startAttempt(READER, TARGET, zeroRng)).question!
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const bankQ = bank.questions.find((q) => q.id === question.questionId)!
      const wrong = wrongAnswerFor(bankQ.correctAnswer, question.options)
      const res = await answerAttempt(READER, TARGET, question.questionId, wrong)
      if (res.nextQuestion) question = res.nextQuestion
    }
    expect(__getSessionForTests(READER, TARGET)!.status).toBe('blocked')

    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + BLOCK_DURATION_MS + 1000)

    const afterCooldown = await startAttempt(READER, TARGET, zeroRng)
    expect(afterCooldown.status).toBe('active')
    expect(afterCooldown.attemptsUsed).toBe(0)
    expect(afterCooldown.blockedUntil).toBeNull()
  })
})

describe('concurrent attempts', () => {
  it('two concurrent submissions of the same (now-stale) question only count once', async () => {
    const start = await startAttempt(READER, TARGET, zeroRng)
    const q = start.question!
    const bankQ = bank.questions.find((x) => x.id === q.questionId)!
    const wrong = wrongAnswerFor(bankQ.correctAnswer, q.options)

    // fired concurrently — jsonStore.mutateTable serialises them, so the
    // second call always sees the first call's already-updated session and
    // is rejected as stale rather than double-counting the attempt.
    const [a, b] = await Promise.all([
      answerAttempt(READER, TARGET, q.questionId, wrong),
      answerAttempt(READER, TARGET, q.questionId, wrong),
    ])

    const session = __getSessionForTests(READER, TARGET)!
    expect(session.attemptsUsed).toBe(1)
    expect(session.status).toBe('active')

    const feedbacks = [a.feedback, b.feedback]
    expect(feedbacks.some((f) => /no longer active/i.test(f))).toBe(true)
  })

  it('never exceeds MAX_ATTEMPTS even under a burst of concurrent correct-sequence submissions', async () => {
    let question = (await startAttempt(READER, TARGET, zeroRng)).question!
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const bankQ = bank.questions.find((x) => x.id === question.questionId)!
      const wrong = wrongAnswerFor(bankQ.correctAnswer, question.options)
      // each iteration still fires two concurrent identical submissions
      const [res] = await Promise.all([
        answerAttempt(READER, TARGET, question.questionId, wrong),
        answerAttempt(READER, TARGET, question.questionId, wrong),
      ])
      if (res.nextQuestion) question = res.nextQuestion
    }
    const session = __getSessionForTests(READER, TARGET)!
    expect(session.attemptsUsed).toBeLessThanOrEqual(MAX_ATTEMPTS)
  })
})

describe('answering without an active session', () => {
  it('is rejected gracefully instead of throwing', async () => {
    const res = await answerAttempt(READER, TARGET, 'not-a-real-question-id', 'anything')
    expect(res.correct).toBe(false)
    expect(res.feedback).toMatch(/start a read-check/i)
  })
})
