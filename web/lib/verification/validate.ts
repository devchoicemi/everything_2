/**
 * Framework-free validation for owner-authored read-check questions — safe
 * to import from both client components (live form validation) and server
 * routes (the actual source of truth). Deliberately has zero imports beyond
 * plain TS, so it never pulls server-only modules (fs, cookies) into a
 * client bundle.
 */

export interface GateQuestionInput {
  question: string
  correctAnswer: string
  distractors: string[]
}

export function validateGateQuestions(qs: GateQuestionInput[]): string[] {
  const errors: string[] = []
  if (qs.length < 4 || qs.length > 5) {
    errors.push(`Provide 4 to 5 questions (got ${qs.length}).`)
  }
  qs.forEach((q, i) => {
    if (!q.question?.trim()) errors.push(`Question ${i + 1}: question text is required.`)
    if (!q.correctAnswer?.trim()) errors.push(`Question ${i + 1}: a correct answer is required.`)
    const distractors = (q.distractors ?? []).map((d) => d.trim()).filter(Boolean)
    if (distractors.length < 2 || distractors.length > 3) {
      errors.push(`Question ${i + 1}: provide 2-3 other (incorrect) options.`)
    }
  })
  return errors
}
