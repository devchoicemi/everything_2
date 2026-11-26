/**
 * Guidance and quality checks for the "tell us about yourself" part of a profile.
 *
 * People fill a blank box with whatever gets them past it ("123445566", "asdfgh", the same word
 * ten times). Two things help: ask specific questions instead of one blank box (STORY_PROMPTS), and
 * check that what comes back looks like real sentences (checkText). Framework-free, so the screen
 * and the server run the very same rules.
 */

export interface StoryPrompt {
  id: string
  /** short title used on the finished profile */
  title: string
  /** the question the member answers */
  label: string
  help: string
  example: string
}

export const STORY_PROMPTS: StoryPrompt[] = [
  {
    id: 'weekend',
    title: 'A perfect weekend',
    label: 'A perfect weekend for me looks like…',
    help: 'Where you are, who you are with, and what you do.',
    example: 'A slow morning with coffee, a long walk by the sea, then football with friends and cooking dinner together.',
  },
  {
    id: 'looking',
    title: 'What I am looking for',
    label: 'What I am looking for in a partner…',
    help: 'The kind of person and the kind of relationship you hope for.',
    example: 'Someone kind and curious, who laughs easily, is honest about what they want and is ready for something real.',
  },
  {
    id: 'passion',
    title: 'What I care about',
    label: 'What I care about and spend my time on…',
    help: 'Your work, studies, hobbies, causes. Whatever fills your days.',
    example: 'My work as a software engineer, playing music on weekends, football, and staying active and learning new things.',
  },
  {
    id: 'friends',
    title: 'How people see me',
    label: 'People who know me well would say I am…',
    help: 'Two or three honest qualities, with a little detail.',
    example: 'Loyal and funny, a bit stubborn, and always the first to suggest an adventure or a long dinner.',
  },
  {
    id: 'surprise',
    title: 'Something that might surprise you',
    label: 'Something that might surprise you about me…',
    help: 'Optional, but it is often what people remember.',
    example: 'I speak four languages, I can cook a proper jollof, and I once ran a half marathon in the rain.',
  },
]

/** How many prompts must be answered, and how long each answer must be. */
export const MIN_PROMPTS_ANSWERED = 3
export const MIN_WORDS_PER_ANSWER = 8
export const MAX_WORDS_PER_ANSWER = 150
/** For profiles written before the prompts existed: one long free text is still accepted. */
export const MIN_WORDS_FREE_TEXT = 40
export const MAX_WORDS_TOTAL = 1000

export type TextProblem = 'empty' | 'too_short' | 'too_long' | 'mostly_numbers' | 'repeated' | 'gibberish'

export interface TextCheck {
  ok: boolean
  /** words that look like real words (letters, a vowel, not keyboard mash) */
  meaningfulWords: number
  problem?: TextProblem
  /** friendly, specific guidance to show the member */
  message?: string
}

const VOWELS = /[aeiouyåäöáàâãéèêëíìîïóòôõúùûüæøœ]/i
const KEYBOARD_ROWS = ['qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop', 'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl', 'zxcv', 'xcvb', 'cvbn', 'vbnm']
const WORD_RE = /\p{L}+(?:['’-]\p{L}+)*/gu

function looksLikeWord(token: string): boolean {
  const t = token.toLowerCase()
  if (t.length > 24) return false
  if (t.length === 1) return t === 'i' || t === 'a'
  if (!VOWELS.test(t)) return false // "hjkl", "brr"
  if (/(.)\1{2,}/.test(t)) return false // "aaaa", "sooo" is fine at 2, not at 3+
  if (/[^aeiouyåäöáàâãéèêëíìîïóòôõúùûüæøœ\W\d_]{6,}/i.test(t)) return false // six consonants in a row
  if (t.length >= 4 && KEYBOARD_ROWS.some((k) => t.includes(k))) return false
  return true
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Checks that `text` reads like a person writing about themselves.
 * `minWords` is the number of real-looking words needed; `maxWords` the cap.
 */
export function checkText(text: string, opts: { minWords?: number; maxWords?: number } = {}): TextCheck {
  const minWords = opts.minWords ?? MIN_WORDS_PER_ANSWER
  const maxWords = opts.maxWords ?? MAX_WORDS_PER_ANSWER
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { ok: false, meaningfulWords: 0, problem: 'empty' }

  const raw = countWords(trimmed)
  if (raw > maxWords) {
    return { ok: false, meaningfulWords: 0, problem: 'too_long', message: `Keep this to ${maxWords} words or fewer (it is ${raw}).` }
  }

  const tokens = trimmed.match(WORD_RE) ?? []
  const real = tokens.filter(looksLikeWord)
  const meaningfulWords = real.length

  const visible = trimmed.replace(/\s/g, '')
  const letters = (visible.match(/\p{L}/gu) ?? []).length
  const digits = (visible.match(/\d/g) ?? []).length
  if (visible.length >= 6 && (letters / visible.length < 0.55 || digits > letters)) {
    return {
      ok: false,
      meaningfulWords,
      problem: 'mostly_numbers',
      message: 'This is mostly numbers or symbols. Write a few real sentences about you, in your own words.',
    }
  }

  const lower = tokens.map((t) => t.toLowerCase())
  const unique = new Set(lower).size
  const sameInARow = lower.some((t, i) => i >= 3 && t === lower[i - 1] && t === lower[i - 2] && t === lower[i - 3])
  if (sameInARow || (lower.length >= 8 && unique / lower.length < 0.45)) {
    return {
      ok: false,
      meaningfulWords,
      problem: 'repeated',
      message: 'The same words keep repeating. Describe yourself with different words so a match can really get to know you.',
    }
  }

  if (tokens.length >= 3 && real.length / tokens.length < 0.6) {
    return {
      ok: false,
      meaningfulWords,
      problem: 'gibberish',
      message: 'Some of this does not look like real words. Write it the way you would say it to someone you just met.',
    }
  }

  if (meaningfulWords < minWords) {
    return {
      ok: false,
      meaningfulWords,
      problem: 'too_short',
      message: `A little more, please: at least ${minWords} words (you have ${meaningfulWords}).`,
    }
  }
  return { ok: true, meaningfulWords }
}

export interface StoryInput {
  prompts: Record<string, string>
  extra: string
}

export interface StoryAssessment {
  ok: boolean
  answered: number
  /** per prompt id: the check, only for prompts that have text */
  checks: Record<string, TextCheck>
  extra?: TextCheck
  /** what the member still needs to do, in plain words */
  message?: string
}

/** The whole "about me" section: enough good answers, and nothing in it that looks like filler. */
export function assessStory(story: StoryInput): StoryAssessment {
  const checks: Record<string, TextCheck> = {}
  let answered = 0
  let anyBad = false
  for (const p of STORY_PROMPTS) {
    const text = story.prompts?.[p.id] ?? ''
    if (!text.trim()) continue
    const c = checkText(text)
    checks[p.id] = c
    if (c.ok) answered++
    else anyBad = true
  }
  const extraText = story.extra?.trim() ?? ''
  const extra = extraText ? checkText(extraText, { minWords: 5, maxWords: MAX_WORDS_TOTAL }) : undefined
  if (extra && !extra.ok) anyBad = true

  // Older profiles: one long free text and no prompts.
  const legacyOk = answered === 0 && extra?.ok === true && extra.meaningfulWords >= MIN_WORDS_FREE_TEXT

  if (anyBad) return { ok: false, answered, checks, extra, message: 'Fix the answers marked above to continue.' }
  if (answered >= MIN_PROMPTS_ANSWERED || legacyOk) return { ok: true, answered, checks, extra }
  const need = MIN_PROMPTS_ANSWERED - answered
  return {
    ok: false,
    answered,
    checks,
    extra,
    message: `Answer ${need} more question${need === 1 ? '' : 's'} to continue (at least ${MIN_WORDS_PER_ANSWER} words each).`,
  }
}

/** The text the AI drafter and the profile use: the answers in order, then anything extra. */
export function composeStory(story: StoryInput): string {
  const parts = STORY_PROMPTS.map((p) => story.prompts?.[p.id]?.trim() ?? '').filter(Boolean)
  if (story.extra?.trim()) parts.push(story.extra.trim())
  return parts.join('\n\n')
}
