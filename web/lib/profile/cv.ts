import { VARIABLE_CATALOG, getVariableConfig } from '@/lib/compat/config'
import { formatSelfValue } from '@/lib/compat/format'
import { isVariableComplete, type CompatDraft } from '@/lib/compat/onboardingDraft'
import type { BucketDef, OptionDef } from '@/lib/compat/types'
import { STORY_PROMPTS } from '@/lib/profile/quality'
import type { ConnectReason, Match, Profile, ProfileAnswer } from '@/types'

/**
 * Everything a profile shows, in the sections a CV has. One shape feeds all four layouts,
 * and every value comes from something the member entered: nothing is invented here.
 */
export interface CVFact {
  label: string
  value: string
}

export interface ProfileCV {
  username: string
  initial: string
  headline: string
  /** short public bio: the first thing a reader sees */
  summary: string
  /** the longer story */
  about: string
  /** the member's answers to the guided questions, shown as sections (own profile, when no AI draft is approved) */
  story: { title: string; text: string }[]
  facts: CVFact[]
  lifestyle: string[]
  interests: string[]
  values: CVFact[]
  lookingFor: CVFact[]
  datePrefs: CVFact[]
  /** only on other members' profiles */
  connect: ConnectReason[]
  answers: ProfileAnswer[]
  verified: boolean
}

const clean = (s: string) => s.replace(/^["“”]+|["“”]+$/g, '').trim()

/* ------------------------------ own profile ------------------------------ */

export interface MemberSource {
  username: string
  onboarding: {
    city: string
    intent: string | null
    headline: string
    profession: string
    lifestyle: string[]
    dateTypes: string[]
    atmosphere: string[]
    bestTime: string | null
    safety: string | null
  }
  compat: CompatDraft
  ai: {
    rawText: string
    shortBio: string
    detailedProfile: string
    tags: string[]
    approved: boolean
    prompts?: Record<string, string>
    extra?: string
  }
}

function optionLabels(field: string, keys: string[]): string[] {
  const cfg = getVariableConfig(field)
  const opts = (cfg?.options ?? []) as OptionDef[]
  return keys.map((k) => opts.find((o) => o.key === k)?.label ?? k)
}

export function cvFromMember(src: MemberSource): ProfileCV {
  const { onboarding: ob, compat, ai } = src
  const pick = (field: string) => {
    const cfg = VARIABLE_CATALOG.find((v) => v.field === field)!
    return cfg ? formatSelfValue(cfg, compat[field]?.self) : ''
  }

  // The reviewed AI draft replaces the member's raw words only once they approved it.
  const useDraft = ai.approved && ai.detailedProfile.trim().length > 0
  const about = (useDraft ? ai.detailedProfile : ai.rawText).trim()
  // A separate short summary exists only when the member approved the AI draft; otherwise their own words are shown once.
  const summary = useDraft && ai.shortBio.trim() ? ai.shortBio.trim() : ''

  const hobbies = Array.isArray(compat.hobbies?.self) ? (compat.hobbies.self as string[]) : []
  const interests = Array.from(new Set([...hobbies, ...(useDraft ? ai.tags : [])]))

  // Without an approved AI draft, the member's own answers show as sections, in their own words.
  const answered = STORY_PROMPTS.map((p) => ({ title: p.title, text: (ai.prompts?.[p.id] ?? '').trim() })).filter((x) => x.text)
  const story = !useDraft && answered.length ? [...answered, ...(ai.extra?.trim() ? [{ title: 'More about me', text: ai.extra.trim() }] : [])] : []

  const facts: CVFact[] = [
    { label: 'Age', value: pick('age') },
    { label: 'Height', value: pick('height') },
    { label: 'City', value: ob.city },
    { label: 'Looking for', value: ob.intent ?? '' },
    { label: 'Work', value: ob.profession },
  ].filter((f) => f.value)

  const values: CVFact[] = [
    { label: 'Wants children', value: pick('wants_children') },
    { label: 'Importance of faith', value: pick('religion_importance') },
    { label: 'Relationship goal', value: pick('relationship_goal') },
    { label: 'Education', value: pick('education_level') },
    { label: 'Career', value: pick('career_ambition') },
    { label: 'Smoking', value: pick('smoking') },
    { label: 'Exercise', value: pick('exercise_frequency') },
  ].filter((f) => f.value)

  // What matters most in a partner: the traits this member weighted highest, with what they rated highest.
  const lookingFor: CVFact[] = VARIABLE_CATALOG.filter((cfg) => cfg.field !== 'hobbies')
    .map((cfg) => ({ cfg, v: compat[cfg.field] }))
    .filter(({ cfg, v }) => v && isVariableComplete(cfg, v))
    .sort((a, b) => b.v.weight - a.v.weight)
    .slice(0, 4)
    .map(({ cfg, v }) => {
      const ideal = v.ideal as Record<string, number>
      const top = ((cfg.options ?? []) as (OptionDef | BucketDef)[])
        .filter((o) => (ideal[o.key] ?? 0) >= 70)
        .map((o) => o.label)
      return {
        label: cfg.label + (v.dealbreaker ? ' (dealbreaker)' : ''),
        value: top.length ? top.join(', ') : 'Open to anything',
      }
    })

  const datePrefs: CVFact[] = [
    { label: 'Type', value: ob.dateTypes.join(' · ') },
    { label: 'Atmosphere', value: ob.atmosphere.join(' · ') },
    { label: 'Best time', value: ob.bestTime ?? '' },
    { label: 'Safety', value: ob.safety ?? '' },
  ].filter((f) => f.value)

  return {
    username: src.username,
    initial: src.username.charAt(0).toUpperCase() || '?',
    headline: clean(ob.headline),
    summary,
    about: story.length ? '' : about,
    story,
    facts,
    lifestyle: ob.lifestyle,
    interests,
    values,
    lookingFor,
    datePrefs,
    connect: [],
    answers: [],
    verified: true,
  }
}

/* --------------------------- other members' profiles --------------------------- */

export function cvFromProfile(p: Profile): ProfileCV {
  if (p.cv) return p.cv // a real member: the server already built their CV
  return {
    username: p.un,
    initial: p.av,
    headline: clean(p.headline),
    summary: '',
    about: p.about,
    story: [],
    facts: [
      { label: 'Age', value: String(p.age) },
      { label: 'City', value: p.city },
      { label: 'Looking for', value: p.intent },
    ],
    lifestyle: p.ls,
    interests: p.tags,
    values: [],
    lookingFor: [],
    datePrefs: p.ds ? [{ label: 'Ideal first date', value: p.ds }] : [],
    connect: p.hl,
    answers: p.ans,
    verified: true,
  }
}

export function cvFromMatch(m: Match): ProfileCV {
  if (m.cv) return m.cv
  return {
    username: m.un,
    initial: m.av,
    headline: clean(m.hl),
    summary: '',
    about: '',
    story: [],
    facts: [
      { label: 'Age', value: String(m.age) },
      { label: 'City', value: m.city },
      { label: 'Looking for', value: m.intent },
    ],
    lifestyle: [],
    interests: [],
    values: [],
    lookingFor: [],
    datePrefs: [],
    connect: m.why,
    answers: m.ans,
    verified: true,
  }
}
