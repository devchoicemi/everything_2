// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyCompatDraft } from '@/lib/compat/onboardingDraft'
import { VARIABLE_CATALOG, bucketOf } from '@/lib/compat/config'
import { fitWord, importanceWord } from '@/lib/compat/scale'
import { formatSelfValue } from '@/lib/compat/format'
import { cvFromMember, cvFromProfile } from '@/lib/profile/cv'
import { PROFILE_LAYOUTS, normalizeLayout } from '@/lib/profile/layouts'
import { PROFILES } from '@/lib/mock-data'
import { destinationFor, type SessionState } from '@/services/auth'
import { migrateDraft, picksToGateQuestions } from '@/store'
import { validateGateQuestions } from '@/lib/verification/validate'
import { STATIC_POOL } from '@/lib/questionPool'

const ob = {
  city: 'Helsinki',
  intent: 'Serious relationship',
  headline: '"Slow mornings and honest conversations"',
  profession: 'Technology / engineering',
  lifestyle: ['Non-smoker', 'Morning person'],
  dateTypes: ['Coffee', 'Walk outdoors'],
  atmosphere: ['Quiet'],
  bestTime: 'Afternoon, 2pm to 5pm',
  safety: 'Public place only',
}

describe('height in centimetres', () => {
  const height = VARIABLE_CATALOG.find((v) => v.field === 'height')!
  it('uses four plain cm bands', () => {
    expect(bucketOf(height, 150)).toBe('h_under_160')
    expect(bucketOf(height, 160)).toBe('h_160_169')
    expect(bucketOf(height, 169)).toBe('h_160_169')
    expect(bucketOf(height, 170)).toBe('h_170_179')
    expect(bucketOf(height, 180)).toBe('h_180_plus')
    expect(bucketOf(height, 205)).toBe('h_180_plus')
  })
  it('shows heights as cm, never inches', () => {
    expect(formatSelfValue(height, 178)).toBe('178 cm')
    expect((height.options as { label: string }[]).map((o) => o.label).join()).not.toMatch(/'|"|ft/)
  })
})

describe('what the sliders mean', () => {
  it('labels the whole 0-100 range with plain words, and never repeats a band', () => {
    expect(fitWord(0)).toBe('Not for me')
    expect(fitWord(100)).toBe('My ideal')
    expect([0, 25, 50, 70, 90].map(fitWord)).toEqual(['Not for me', 'Would rather not', 'Fine either way', 'I would like that', 'My ideal'])
    expect(importanceWord(10)).toBe('Barely matters')
    expect(importanceWord(100)).toBe('Essential')
  })
})

describe('profile layouts', () => {
  it('offers four CV designs', () => {
    expect(PROFILE_LAYOUTS.map((l) => l.id)).toEqual(['timeline', 'sidebar', 'colorblock', 'bloom'])
  })
  it('keeps the three older ids working', () => {
    expect(normalizeLayout('classic')).toBe('timeline')
    expect(normalizeLayout('editorial')).toBe('bloom')
    expect(normalizeLayout('minimal')).toBe('sidebar')
    expect(normalizeLayout(undefined)).toBe('timeline')
    expect(normalizeLayout('nonsense')).toBe('timeline')
  })
})

describe('profile CV', () => {
  it('structures only what the member entered', () => {
    const compat = emptyCompatDraft()
    compat.height = { ...compat.height, self: 178 }
    compat.age = { ...compat.age, self: 29 }
    compat.hobbies = { ...compat.hobbies, self: ['Reading', 'Hiking'] }
    compat.wants_children = { ...compat.wants_children, self: 'maybe' }
    const cv = cvFromMember({
      username: 'Birch_Storm',
      onboarding: ob,
      compat,
      ai: { rawText: 'I love slow mornings. Coffee first, plans later. Weekends are for walking.', shortBio: '', detailedProfile: '', tags: ['Foodie'], approved: false },
    })
    expect(cv.username).toBe('Birch_Storm')
    expect(cv.headline).toBe('Slow mornings and honest conversations')
    expect(cv.facts).toEqual([
      { label: 'Age', value: '29' },
      { label: 'Height', value: '178 cm' },
      { label: 'City', value: 'Helsinki' },
      { label: 'Looking for', value: 'Serious relationship' },
      { label: 'Work', value: 'Technology / engineering' },
    ])
    expect(cv.interests).toEqual(['Reading', 'Hiking']) // unapproved AI tags are not added
    expect(cv.values).toContainEqual({ label: 'Wants children', value: 'Open to it' })
    expect(cv.datePrefs.map((d) => d.label)).toEqual(['Type', 'Atmosphere', 'Best time', 'Safety'])
    expect(cv.summary).toBe('') // own words are shown once, as the story
    expect(cv.about).toContain('slow mornings')
  })

  it('uses the AI draft only once it has been approved', () => {
    const base = { rawText: 'my own words about myself and what I like to do each week', shortBio: 'AI short', detailedProfile: 'AI long story', tags: ['Foodie'] }
    const compat = emptyCompatDraft()
    const off = cvFromMember({ username: 'A', onboarding: ob, compat, ai: { ...base, approved: false } })
    const on = cvFromMember({ username: 'A', onboarding: ob, compat, ai: { ...base, approved: true } })
    expect(off.about).toBe(base.rawText)
    expect(on.summary).toBe('AI short')
    expect(on.about).toBe('AI long story')
    expect(on.interests).toContain('Foodie')
  })

  it('leaves empty sections out rather than inventing them', () => {
    const cv = cvFromMember({ username: 'A', onboarding: { ...ob, lifestyle: [], dateTypes: [], atmosphere: [], bestTime: null, safety: null, profession: '' }, compat: emptyCompatDraft(), ai: { rawText: '', shortBio: '', detailedProfile: '', tags: [], approved: false } })
    expect(cv.datePrefs).toEqual([])
    expect(cv.values).toEqual([])
    expect(cv.lookingFor).toEqual([])
    expect(cv.facts.map((f) => f.label)).toEqual(['City', 'Looking for'])
  })

  it('draws other members as a CV too, with no photo fields', () => {
    const cv = cvFromProfile(PROFILES[0])
    expect(cv.username).toBe(PROFILES[0].un)
    expect(cv.connect.length).toBeGreaterThan(0)
    expect(cv.answers.length).toBeGreaterThan(0)
    expect(JSON.stringify(cv)).not.toMatch(/photo|image|avatar|jpg|png/i)
  })
})

describe('read-check questions come from the pool', () => {
  it('turns a pick into a valid gate question (one true answer, the pool\'s other answers as the wrong ones)', () => {
    const picks = STATIC_POOL.slice(0, 4).map((q) => ({ id: q.id, question: q.question, options: q.options, answer: q.options[1] }))
    const gate = picksToGateQuestions(picks)
    expect(gate[0].correctAnswer).toBe(STATIC_POOL[0].options[1])
    expect(gate[0].distractors).not.toContain(gate[0].correctAnswer)
    expect(validateGateQuestions(gate.map((g) => ({ ...g, distractors: g.distractors.filter(Boolean) })))).toEqual([])
  })
  it('the starting pool has suggested answers for every question', () => {
    expect(STATIC_POOL.length).toBe(30)
    expect(STATIC_POOL.every((q) => q.options.length === 4)).toBe(true)
  })
})

describe('older saved drafts are repaired', () => {
  it('resets inch-based height and old design names, and drops "verified only"', () => {
    const compat = emptyCompatDraft()
    compat.height = { ...compat.height, self: 67, ideal: { '5_6_to_5_11': 100 } }
    const out = migrateDraft({
      compatDraft: compat,
      aiDraft: { layout: 'editorial' },
      onboarding: { safety: 'Verified users only', dealbreakers: ['Verified only', 'Block smokers'] },
    }) as any
    expect(out.compatDraft.height.self).toBeNull()
    expect(out.compatDraft.height.ideal).toEqual({})
    expect(out.aiDraft.layout).toBe('bloom')
    expect(out.onboarding.safety).toBeNull()
    expect(out.onboarding.dealbreakers).toEqual(['Block smokers'])
    expect(out.onboarding.consentSensitive).toBe(false)
    expect(out.poolPicks).toEqual([])
  })
  it('leaves a current-format draft alone', () => {
    const compat = emptyCompatDraft()
    compat.height = { ...compat.height, self: 178, ideal: { h_170_179: 100 } }
    const out = migrateDraft({ compatDraft: compat }) as any
    expect(out.compatDraft.height.self).toBe(178)
  })
})

describe('where sign-in sends a member', () => {
  const base = (over: Partial<SessionState> & { onboarded: boolean }): SessionState => ({
    authenticated: true,
    next: 'continue',
    requirements: { emailVerification: false, identity: false },
    user: { id: 'u', email: 'a@b.co', username: 'Birch_Storm', role: 'member', emailVerified: true, identityVerified: true, onboarded: over.onboarded, createdAt: '' },
    ...over,
  })
  it('a returning member who finished setup goes to Discover, not back to sign-up', () => {
    expect(destinationFor(base({ onboarded: true }))).toBe('/discover')
    expect(destinationFor(base({ onboarded: true }), '/onboarding?step=1')).toBe('/discover')
  })
  it('keeps the page they were heading to', () => {
    expect(destinationFor(base({ onboarded: true }), '/matches')).toBe('/matches')
  })
  it('a new member goes to onboarding', () => {
    expect(destinationFor(base({ onboarded: false }))).toBe('/onboarding?step=1')
    expect(destinationFor(base({ onboarded: false }), '/matches')).toBe('/onboarding?step=1')
  })
  it('checks still come first', () => {
    expect(destinationFor(base({ onboarded: true, next: 'verify_identity' }))).toBe('/verify')
    expect(destinationFor(base({ onboarded: true, next: 'prelaunch' }))).toBe('/you-are-in')
  })
})
