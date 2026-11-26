import { QUESTIONS, QUESTION_DIMENSIONS } from '@/lib/questions'

/**
 * The read-check question pool: every question has suggested answers, and a member picks the
 * questions that suit them and the answer that is true for them. The wrong options a reader
 * sees are the other suggested answers. The pool starts from lib/questions.ts and grows
 * (see POST /api/v1/admin/questions) as people use ChoiceMi.
 */
export interface PoolQuestion {
  id: string
  theme: string
  question: string
  options: string[]
}

export interface PoolTheme {
  id: string
  label: string
}

export const POOL_THEMES: PoolTheme[] = QUESTION_DIMENSIONS.map((d) => ({ id: d.id, label: d.label }))

export const STATIC_POOL: PoolQuestion[] = QUESTION_DIMENSIONS.flatMap((d) =>
  QUESTIONS[d.id].map((q) => ({ id: q.id, theme: d.id, question: q.q, options: q.opts })),
)

export const POOL_OPTIONS_MIN = 3
export const POOL_OPTIONS_MAX = 4
