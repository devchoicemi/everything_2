/**
 * Plain-language meaning of the two 0-100 scales a member moves while building their profile.
 *
 *  - "How much would you want…" (the rating for each option): 0 = not for me, 100 = my ideal.
 *  - "How much does this matter?" (importance): low = barely matters, high = essential.
 *
 * The same words are used for every trait, so the numbers always mean the same thing.
 */

export const FIT_LOW = 'Not for me'
export const FIT_HIGH = 'My ideal'
export const IMPORTANCE_LOW = 'Barely matters'
export const IMPORTANCE_HIGH = 'Essential'

export function fitWord(percent: number): string {
  if (percent < 20) return 'Not for me'
  if (percent < 40) return 'Would rather not'
  if (percent < 60) return 'Fine either way'
  if (percent < 80) return 'I would like that'
  return 'My ideal'
}

export function importanceWord(weight: number): string {
  if (weight < 30) return 'Barely matters'
  if (weight < 50) return 'Matters a little'
  if (weight < 70) return 'Matters'
  if (weight < 90) return 'Matters a lot'
  return 'Essential'
}
