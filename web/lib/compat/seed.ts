import type { CompatVariableInput, UserCompatProfile } from './types'
import { validateUserVariables } from './engine'

/**
 * Demo compatibility data for the pilot's seeded profiles, matching the
 * personas in lib/mock-data.ts. Every SMALL_SET/BUCKETED_CONTINUOUS field is
 * fully rated (policy: no unrated options — see engine.ts) by spreading a
 * neutral base template and overriding the keys that matter to that persona,
 * which keeps every persona valid by construction.
 */

const BASE = {
  height: { h_under_160: 50, 'h_160_169': 80, 'h_170_179': 90, 'h_180_plus': 80 },
  age: { '18_24': 60, '25_30': 90, '31_38': 90, '39_plus': 60 },
  smoking: { non_smoker: 90, occasional: 40, regular: 15 },
  exercise_frequency: { rarely: 50, sometimes: 80, often: 80 },
  wants_children: { no: 50, maybe: 70, yes: 70 },
  religion_importance: { not_important: 70, somewhat: 80, very: 50 },
  relationship_goal: { casual: 40, long_term: 90, marriage: 70 },
  education_level: { secondary: 50, bachelor: 90, master: 90, phd: 70 },
  career_ambition: { low: 60, medium: 90, high: 70 },
}

function overrides(field: keyof typeof BASE, patch: Record<string, number>) {
  return { ...BASE[field], ...patch }
}

function persona(opts: {
  height: number
  age: number
  smoking: 'non_smoker' | 'occasional' | 'regular'
  exercise: 'rarely' | 'sometimes' | 'often'
  wantsChildren: 'no' | 'maybe' | 'yes'
  religion: 'not_important' | 'somewhat' | 'very'
  goal: 'casual' | 'long_term' | 'marriage'
  education: 'secondary' | 'bachelor' | 'master' | 'phd'
  ambition: 'low' | 'medium' | 'high'
  hobbies: string[]
  idealHeight: Record<string, number>
  idealAge: Record<string, number>
  idealSmoking: Record<string, number>
  idealExercise: Record<string, number>
  idealChildren: Record<string, number>
  idealReligion: Record<string, number>
  idealGoal: Record<string, number>
  idealEducation: Record<string, number>
  idealAmbition: Record<string, number>
  idealHobbies: string[]
  weights: Partial<Record<string, number>>
  dealbreakers: string[]
}): CompatVariableInput[] {
  const w = (field: string, fallback: number) => opts.weights[field] ?? fallback
  const db = (field: string) => opts.dealbreakers.includes(field)

  return [
    { field: 'height', self: opts.height, ideal: overrides('height', opts.idealHeight), weight: w('height', 25), dealbreaker: db('height') },
    { field: 'age', self: opts.age, ideal: overrides('age', opts.idealAge), weight: w('age', 20), dealbreaker: db('age') },
    { field: 'smoking', self: opts.smoking, ideal: overrides('smoking', opts.idealSmoking), weight: w('smoking', 50), dealbreaker: db('smoking') },
    { field: 'exercise_frequency', self: opts.exercise, ideal: overrides('exercise_frequency', opts.idealExercise), weight: w('exercise_frequency', 25), dealbreaker: db('exercise_frequency') },
    { field: 'wants_children', self: opts.wantsChildren, ideal: overrides('wants_children', opts.idealChildren), weight: w('wants_children', 80), dealbreaker: db('wants_children') },
    { field: 'religion_importance', self: opts.religion, ideal: overrides('religion_importance', opts.idealReligion), weight: w('religion_importance', 30), dealbreaker: db('religion_importance') },
    { field: 'relationship_goal', self: opts.goal, ideal: overrides('relationship_goal', opts.idealGoal), weight: w('relationship_goal', 80), dealbreaker: db('relationship_goal') },
    { field: 'education_level', self: opts.education, ideal: overrides('education_level', opts.idealEducation), weight: w('education_level', 20), dealbreaker: db('education_level') },
    { field: 'career_ambition', self: opts.ambition, ideal: overrides('career_ambition', opts.idealAmbition), weight: w('career_ambition', 25), dealbreaker: db('career_ambition') },
    { field: 'hobbies', self: opts.hobbies, ideal: opts.idealHobbies, weight: w('hobbies', 40), dealbreaker: db('hobbies') },
  ]
}

const SEED: Record<string, CompatVariableInput[]> = {
  // "me" — the signed-in demo user, Birch_Storm
  me: persona({
    height: 175, age: 28, smoking: 'non_smoker', exercise: 'often', wantsChildren: 'maybe',
    religion: 'somewhat', goal: 'long_term', education: 'master', ambition: 'medium',
    hobbies: ['Reading', 'Hiking', 'Cafés & coffee', 'Cinema'],
    idealHeight: { 'h_170_179': 100, 'h_180_plus': 90 },
    idealAge: { '25_30': 90, '31_38': 100 },
    idealSmoking: { non_smoker: 100, occasional: 40, regular: 5 },
    idealExercise: { sometimes: 70, often: 100 },
    idealChildren: { maybe: 80, yes: 100, no: 20 },
    idealReligion: { somewhat: 100, not_important: 70, very: 60 },
    idealGoal: { long_term: 100, marriage: 90, casual: 10 },
    idealEducation: { master: 100, bachelor: 80, phd: 90 },
    idealAmbition: { medium: 100, high: 80 },
    idealHobbies: ['Reading', 'Hiking', 'Museums', 'Cafés & coffee', 'Cinema'],
    weights: { height: 30, age: 20, smoking: 70, exercise_frequency: 25, wants_children: 90, religion_importance: 30, relationship_goal: 80, education_level: 20, career_ambition: 25, hobbies: 40 },
    dealbreakers: ['smoking', 'wants_children', 'relationship_goal'],
  }),

  '1': persona({
    // Maple_Dusk
    height: 175, age: 28, smoking: 'non_smoker', exercise: 'sometimes', wantsChildren: 'no',
    religion: 'not_important', goal: 'long_term', education: 'bachelor', ambition: 'medium',
    hobbies: ['Reading', 'Cafés & coffee', 'Museums', 'Cinema'],
    idealHeight: { 'h_170_179': 100, 'h_180_plus': 100 },
    idealAge: { '25_30': 90, '31_38': 100 },
    idealSmoking: { non_smoker: 100, occasional: 30, regular: 0 },
    idealExercise: { sometimes: 100, often: 80 },
    idealChildren: { no: 100, maybe: 60, yes: 10 },
    idealReligion: { not_important: 100, somewhat: 80, very: 30 },
    idealGoal: { long_term: 100, marriage: 70, casual: 20 },
    idealEducation: { bachelor: 100, master: 100, phd: 80 },
    idealAmbition: { medium: 100, low: 70, high: 60 },
    idealHobbies: ['Reading', 'Museums', 'Cafés & coffee', 'Hiking', 'Yoga'],
    weights: { smoking: 60, relationship_goal: 90 },
    dealbreakers: ['smoking', 'relationship_goal'],
  }),

  '2': persona({
    // Cedar_Mist
    height: 175, age: 31, smoking: 'occasional', exercise: 'often', wantsChildren: 'maybe',
    religion: 'not_important', goal: 'long_term', education: 'bachelor', ambition: 'high',
    hobbies: ['Climbing', 'Cafés & coffee', 'Travel', 'Cycling'],
    idealHeight: { 'h_160_169': 90, 'h_170_179': 100, 'h_180_plus': 90 },
    idealAge: { '25_30': 100, '31_38': 90 },
    idealSmoking: { non_smoker: 90, occasional: 100, regular: 30 },
    idealExercise: { often: 100, sometimes: 80 },
    idealChildren: { maybe: 100, yes: 80, no: 40 },
    idealReligion: { not_important: 100, somewhat: 60 },
    idealGoal: { long_term: 100, casual: 40, marriage: 60 },
    idealEducation: { bachelor: 100, master: 90 },
    idealAmbition: { high: 100, medium: 90 },
    idealHobbies: ['Climbing', 'Travel', 'Cycling', 'Cafés & coffee', 'Photography'],
    weights: { relationship_goal: 60, wants_children: 60 },
    dealbreakers: [],
  }),

  '3': persona({
    // River_Ash
    height: 165, age: 26, smoking: 'non_smoker', exercise: 'sometimes', wantsChildren: 'yes',
    religion: 'very', goal: 'marriage', education: 'bachelor', ambition: 'medium',
    hobbies: ['Reading', 'Running', 'Volunteering'],
    idealHeight: { 'h_170_179': 90, 'h_180_plus': 70, 'h_160_169': 60 },
    idealAge: { '18_24': 80, '25_30': 100, '31_38': 70 },
    idealSmoking: { non_smoker: 100, occasional: 10, regular: 0 },
    idealExercise: { sometimes: 90, often: 70 },
    idealChildren: { yes: 100, maybe: 60, no: 5 },
    idealReligion: { very: 100, somewhat: 70, not_important: 20 },
    idealGoal: { marriage: 100, long_term: 60, casual: 0 },
    idealEducation: { bachelor: 90, master: 100 },
    idealAmbition: { medium: 100, low: 80 },
    idealHobbies: ['Reading', 'Running', 'Volunteering', 'Museums'],
    weights: { religion_importance: 70, wants_children: 100, smoking: 40 },
    dealbreakers: ['wants_children', 'religion_importance'],
  }),

  '4': persona({
    // Storm_Pine
    height: 185, age: 33, smoking: 'non_smoker', exercise: 'sometimes', wantsChildren: 'yes',
    religion: 'somewhat', goal: 'marriage', education: 'bachelor', ambition: 'high',
    hobbies: ['Board games', 'Cinema', 'Cafés & coffee', 'Travel'],
    idealHeight: { 'h_170_179': 80, 'h_180_plus': 60, 'h_160_169': 100 },
    idealAge: { '25_30': 90, '31_38': 100 },
    idealSmoking: { non_smoker: 100, occasional: 20 },
    idealExercise: { sometimes: 90, often: 70 },
    idealChildren: { yes: 90, maybe: 100 },
    idealReligion: { somewhat: 100, not_important: 80 },
    idealGoal: { marriage: 100, long_term: 80 },
    idealEducation: { bachelor: 100, master: 90 },
    idealAmbition: { high: 90, medium: 100 },
    idealHobbies: ['Cinema', 'Cafés & coffee', 'Travel', 'Board games', 'Live music'],
    weights: { wants_children: 60, relationship_goal: 70 },
    dealbreakers: [],
  }),
}

export function getSeedCompatProfile(userId: string): UserCompatProfile | undefined {
  const variables = SEED[userId]
  if (!variables) return undefined
  return { userId, variables }
}

export function listSeedUserIds(): string[] {
  return Object.keys(SEED)
}

// Self-check at module load, in dev only — fail loudly if a seed persona is
// invalid rather than silently shipping a broken demo.
if (process.env.NODE_ENV !== 'production') {
  for (const [id, variables] of Object.entries(SEED)) {
    const errors = validateUserVariables(variables)
    if (errors.length) {
      // eslint-disable-next-line no-console
      console.error(`[compat seed] persona "${id}" failed validation:`, errors)
    }
  }
}
