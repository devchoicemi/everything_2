/**
 * The profile-reading verification gate — deliberately separate from the
 * compatibility engine (lib/compat/*). Nothing here ever reads or writes a
 * compatibility score.
 */

export interface GateQuestion {
  id: string
  question: string
  correctAnswer: string
  /** owner-authored distractors + the correct answer, in storage order (shuffled only at serve time) */
  options: string[]
}

export interface ProfileGateBank {
  profileId: string
  questions: GateQuestion[]
}

export type AttemptStatus = 'active' | 'passed' | 'blocked'

export interface AttemptSession {
  readerId: string
  targetId: string
  status: AttemptStatus
  attemptsUsed: number
  askedQuestionIds: string[]
  currentQuestionId: string | null
  blockedUntil: number | null
  passedAt: number | null
  updatedAt: number
}

export interface PublicQuestion {
  questionId: string
  question: string
  options: string[]
}

export interface StartResult {
  status: AttemptStatus
  attemptsUsed: number
  attemptsRemaining: number
  question: PublicQuestion | null
  blockedUntil: number | null
}

export interface AnswerResult {
  correct: boolean
  status: AttemptStatus
  attemptsUsed: number
  attemptsRemaining: number
  nextQuestion: PublicQuestion | null
  blockedUntil: number | null
  feedback: string
}
