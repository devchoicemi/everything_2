import { describe, expect, it } from 'vitest'
import { compatibilityScore, directionalPercent, matchLabel, validateUserVariables } from './engine'
import type { CompatVariableInput, UserCompatProfile } from './types'

describe('matchLabel', () => {
  it('bands scores per the spec (§9)', () => {
    expect(matchLabel(95, false)).toBe('perfect')
    expect(matchLabel(90, false)).toBe('perfect')
    expect(matchLabel(89, false)).toBe('strong')
    expect(matchLabel(70, false)).toBe('strong')
    expect(matchLabel(69, false)).toBe('partial')
    expect(matchLabel(40, false)).toBe('partial')
    expect(matchLabel(39, false)).toBe('weak')
    expect(matchLabel(1, false)).toBe('weak')
    expect(matchLabel(0, false)).toBe('none')
  })

  it('always tags a dealbreaker variable regardless of score', () => {
    expect(matchLabel(100, true)).toBe('dealbreaker')
    expect(matchLabel(0, true)).toBe('dealbreaker')
  })
})

describe('validateUserVariables', () => {
  const base: CompatVariableInput = {
    field: 'smoking',
    self: 'non_smoker',
    ideal: { non_smoker: 100, occasional: 40, regular: 5 },
    weight: 50,
    dealbreaker: false,
  }

  it('accepts a fully-rated, in-range variable', () => {
    expect(validateUserVariables([base])).toEqual([])
  })

  it('rejects a weight outside 10-100', () => {
    expect(validateUserVariables([{ ...base, weight: 5 }])).not.toHaveLength(0)
    expect(validateUserVariables([{ ...base, weight: 101 }])).not.toHaveLength(0)
    expect(validateUserVariables([{ ...base, weight: 9.5 }])).not.toHaveLength(0)
  })

  it('rejects a missing ideal rating for a configured option (policy: no unrated options)', () => {
    const errors = validateUserVariables([{ ...base, ideal: { non_smoker: 100, occasional: 40 } }])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/missing ideal rating/i)
  })

  it('rejects an out-of-range ideal rating', () => {
    const errors = validateUserVariables([{ ...base, ideal: { ...base.ideal as object, regular: 150 } }])
    expect(errors.length).toBeGreaterThan(0)
  })

  it('caps dealbreakers at 2 per category', () => {
    const dealbreakers: CompatVariableInput[] = [
      { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 40, regular: 5 }, weight: 50, dealbreaker: true },
      { field: 'exercise_frequency', self: 'often', ideal: { rarely: 10, sometimes: 50, often: 100 }, weight: 50, dealbreaker: true },
      { field: 'height', self: 175, ideal: { h_under_160: 10, 'h_160_169': 50, 'h_170_179': 100, 'h_180_plus': 90 }, weight: 50, dealbreaker: true },
    ]
    // all three are physical_lifestyle — 3rd dealbreaker should fail
    const errors = validateUserVariables(dealbreakers)
    expect(errors.some((e) => e.message.includes('at most 2 dealbreakers'))).toBe(true)
  })

  it('accepts exactly 2 dealbreakers in one category', () => {
    const dealbreakers: CompatVariableInput[] = [
      { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 40, regular: 5 }, weight: 50, dealbreaker: true },
      { field: 'exercise_frequency', self: 'often', ideal: { rarely: 10, sometimes: 50, often: 100 }, weight: 50, dealbreaker: true },
    ]
    expect(validateUserVariables(dealbreakers)).toEqual([])
  })

  it('validates MULTI_SELECT tags against the controlled vocabulary', () => {
    const bad: CompatVariableInput = {
      field: 'hobbies',
      self: ['Reading'],
      ideal: ['Reading', 'Not-a-real-tag'],
      weight: 40,
      dealbreaker: false,
    }
    const errors = validateUserVariables([bad])
    expect(errors.some((e) => e.message.includes('not a valid tag'))).toBe(true)
  })
})

describe('directionalPercent — weighted average (§6, §10)', () => {
  it('computes a plain weighted average with no dealbreakers', () => {
    const viewer: UserCompatProfile = {
      userId: 'a',
      variables: [
        { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 40, regular: 0 }, weight: 30, dealbreaker: false },
        { field: 'exercise_frequency', self: 'often', ideal: { rarely: 10, sometimes: 100, often: 80 }, weight: 10, dealbreaker: false },
      ],
    }
    const targetSelf = { smoking: 'regular', exercise_frequency: 'sometimes' }
    const result = directionalPercent(viewer, targetSelf)
    // (30*0 + 10*100) / (40*100) = 25
    expect(result.percent).toBeCloseTo(25, 5)
  })

  it('reproduces the spec worked example §8.1 (Physical & Lifestyle, A→B)', () => {
    const viewer: UserCompatProfile = {
      userId: 'a',
      variables: [
        { field: 'height', self: 175, ideal: { h_under_160: 10, 'h_160_169': 50, 'h_170_179': 100, 'h_180_plus': 90 }, weight: 100, dealbreaker: false },
        { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 10, regular: 0 }, weight: 30, dealbreaker: false },
      ],
    }
    // B is 172 cm (bucket h_170_179 -> 100) and a regular smoker (-> 0)
    const targetSelf = { height: 172, smoking: 'regular' }
    const result = directionalPercent(viewer, targetSelf)
    // (100*100 + 30*0) / (130*100) = 76.9%
    expect(result.percent).toBeCloseTo(76.9, 1)
  })

  it('doubles a dealbreaker variable\'s weight, not its score (§5, §8.2)', () => {
    const withoutDb: UserCompatProfile = {
      userId: 'a',
      variables: [
        { field: 'relationship_goal', self: 'marriage', ideal: { casual: 0, long_term: 0, marriage: 0 }, weight: 100, dealbreaker: false },
        { field: 'education_level', self: 'bachelor', ideal: { secondary: 50, bachelor: 50, master: 50, phd: 50 }, weight: 30, dealbreaker: false },
        { field: 'career_ambition', self: 'high', ideal: { low: 100, medium: 100, high: 100 }, weight: 10, dealbreaker: false },
      ],
    }
    const targetSelf = { relationship_goal: 'casual', education_level: 'bachelor', career_ambition: 'high' }
    const without = directionalPercent(withoutDb, targetSelf)
    expect(without.percent).toBeCloseTo(17.9, 1)

    const withDb: UserCompatProfile = {
      userId: 'a',
      variables: withoutDb.variables.map((v) => (v.field === 'relationship_goal' ? { ...v, dealbreaker: true } : v)),
    }
    const withDouble = directionalPercent(withDb, targetSelf)
    expect(withDouble.percent).toBeCloseTo(10.4, 1)
    // doubling pulls the score DOWN when the dealbreaker is a mismatch — never a floor
    expect(withDouble.percent).toBeLessThan(without.percent)
  })

  it('excludes a variable from the denominator when the target has no self value for it (§11 "incomplete profiles")', () => {
    const viewer: UserCompatProfile = {
      userId: 'a',
      variables: [
        { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 40, regular: 0 }, weight: 50, dealbreaker: false },
        { field: 'exercise_frequency', self: 'often', ideal: { rarely: 0, sometimes: 0, often: 100 }, weight: 50, dealbreaker: false },
      ],
    }
    // target never set exercise_frequency
    const targetSelf = { smoking: 'non_smoker' }
    const result = directionalPercent(viewer, targetSelf)
    expect(result.percent).toBe(100) // only the smoking variable counts, and it's a perfect match
    const excluded = result.breakdown.find((b) => b.field === 'exercise_frequency')
    expect(excluded?.excluded).toBe(true)
    expect(excluded?.excludedReason).toBe('target_self_unset')
  })

  it('scores MULTI_SELECT as an overlap fraction (§3.3)', () => {
    const viewer: UserCompatProfile = {
      userId: 'a',
      variables: [{ field: 'hobbies', self: [], ideal: ['Reading', 'Hiking', 'Cinema', 'Travel', 'Yoga'], weight: 40, dealbreaker: false }],
    }
    const targetSelf = { hobbies: ['Reading', 'Cycling'] }
    const result = directionalPercent(viewer, targetSelf)
    // 1 of 5 ideal tags present -> 20%
    expect(result.percent).toBeCloseTo(20, 5)
  })
})

describe('compatibilityScore — two-directional average (§6, §7, §8.1)', () => {
  it('averages A→B and B→A independently for the final % and matches the worked example', () => {
    const userA: UserCompatProfile = {
      userId: 'a',
      variables: [
        { field: 'height', self: 175, ideal: { h_under_160: 10, 'h_160_169': 50, 'h_170_179': 100, 'h_180_plus': 90 }, weight: 100, dealbreaker: false },
        { field: 'smoking', self: 'non_smoker', ideal: { non_smoker: 100, occasional: 10, regular: 0 }, weight: 30, dealbreaker: false },
        { field: 'wants_children', self: 'yes', ideal: { no: 0, maybe: 60, yes: 100 }, weight: 100, dealbreaker: true },
      ],
    }
    const userB: UserCompatProfile = {
      userId: 'b',
      variables: [
        { field: 'height', self: 175, ideal: { h_under_160: 100, 'h_160_169': 100, 'h_170_179': 100, 'h_180_plus': 100 }, weight: 20, dealbreaker: false },
        { field: 'smoking', self: 'regular', ideal: { non_smoker: 100, occasional: 100, regular: 100 }, weight: 20, dealbreaker: false },
        { field: 'wants_children', self: 'yes', ideal: { no: 100, maybe: 100, yes: 100 }, weight: 60, dealbreaker: false },
      ],
    }

    const result = compatibilityScore(userA, userB)
    // A→B: height(172 cm->100, w100) + smoking(regular->0, w30) + wants_children(dealbreaker w200, yes->100)
    // = (100*100 + 30*0 + 200*100) / (100+30+200)/100 = 90.9
    expect(result.aToB.percent).toBeCloseTo(90.9, 1)
    // B→A: everything rated 100 by B regardless of A's values
    expect(result.bToA.percent).toBe(100)
    expect(result.final).toBeCloseTo(95.5, 1)

    const values = result.byCategory.find((c) => c.category === 'values_family')
    expect(values?.percent).toBeCloseTo(100, 1)
  })
})
