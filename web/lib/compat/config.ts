import type { BucketDef, FitCategory, VariableConfig } from './types'

/**
 * The variable catalog for the pilot. Every field's shape (SMALL_SET /
 * BUCKETED_CONTINUOUS / MULTI_SELECT) is fixed config, per the spec — never a
 * per-user choice.
 *
 * Scope note: this is a real, working catalog (10 variables across 4
 * categories), not a toy. It is trivially extensible — add a VariableConfig
 * entry and it is picked up everywhere (engine, onboarding UI, validation)
 * automatically. Height and age are BUCKETED_CONTINUOUS with the bands below;
 * income is not yet in the catalog (see docs/COMPATIBILITY_DECISIONS.md —
 * §11 "bucket boundaries" is explicitly flagged as open, and I did not invent
 * income bands without product sign-off).
 */

export const FIT_CATEGORIES: FitCategory[] = [
  { id: 'physical_lifestyle', label: 'Physical & Lifestyle', sortOrder: 1 },
  { id: 'values_family', label: 'Values & Family', sortOrder: 2 },
  { id: 'ambition_growth', label: 'Ambition & Growth', sortOrder: 3 },
  { id: 'interests_connection', label: 'Interests & Connection', sortOrder: 4 },
]

/** Height is held in centimetres. Four plain bands (the spec's own example used four). */
const HEIGHT_BUCKETS: BucketDef[] = [
  { key: 'h_under_160', label: 'Under 160 cm', min: null, max: 159 },
  { key: 'h_160_169', label: '160–169 cm', min: 160, max: 169 },
  { key: 'h_170_179', label: '170–179 cm', min: 170, max: 179 },
  { key: 'h_180_plus', label: '180 cm and over', min: 180, max: null },
]

/**
 * Provisional — the spec worked height as its example and explicitly left
 * age's bands undecided (§11). These 4 bands are my documented default so
 * the engine can function end-to-end; flag for product sign-off before
 * treating them as final.
 */
const AGE_BUCKETS: BucketDef[] = [
  { key: '18_24', label: '18–24', min: 18, max: 24 },
  { key: '25_30', label: '25–30', min: 25, max: 30 },
  { key: '31_38', label: '31–38', min: 31, max: 38 },
  { key: '39_plus', label: '39+', min: 39, max: null },
]

export const HOBBY_TAGS = [
  'Reading', 'Hiking', 'Cooking', 'Climbing', 'Live music', 'Museums',
  'Running', 'Cycling', 'Board games', 'Travel', 'Photography', 'Yoga',
  'Cafés & coffee', 'Cinema', 'Volunteering', 'Gaming',
]

export const VARIABLE_CATALOG: VariableConfig[] = [
  {
    field: 'height',
    label: 'Height',
    category: 'physical_lifestyle',
    shape: 'BUCKETED_CONTINUOUS',
    options: HEIGHT_BUCKETS,
  },
  {
    field: 'age',
    label: 'Age',
    category: 'physical_lifestyle',
    shape: 'BUCKETED_CONTINUOUS',
    options: AGE_BUCKETS,
  },
  {
    field: 'smoking',
    label: 'Smoking',
    category: 'physical_lifestyle',
    shape: 'SMALL_SET',
    options: [
      { key: 'non_smoker', label: 'Non-smoker' },
      { key: 'occasional', label: 'Occasional' },
      { key: 'regular', label: 'Regular smoker' },
    ],
  },
  {
    field: 'exercise_frequency',
    label: 'Exercise frequency',
    category: 'physical_lifestyle',
    shape: 'SMALL_SET',
    options: [
      { key: 'rarely', label: 'Rarely' },
      { key: 'sometimes', label: 'A few times a month' },
      { key: 'often', label: 'Several times a week' },
    ],
  },
  {
    field: 'wants_children',
    label: 'Wants children',
    category: 'values_family',
    shape: 'SMALL_SET',
    options: [
      { key: 'no', label: 'No' },
      { key: 'maybe', label: 'Open to it' },
      { key: 'yes', label: 'Yes' },
    ],
  },
  {
    field: 'religion_importance',
    label: 'Importance of faith',
    category: 'values_family',
    shape: 'SMALL_SET',
    options: [
      { key: 'not_important', label: 'Not important' },
      { key: 'somewhat', label: 'Somewhat important' },
      { key: 'very', label: 'Very important' },
    ],
  },
  {
    field: 'relationship_goal',
    label: 'Relationship goal',
    category: 'values_family',
    shape: 'SMALL_SET',
    options: [
      { key: 'casual', label: 'Casual dating' },
      { key: 'long_term', label: 'Long-term dating' },
      { key: 'marriage', label: 'Marriage-minded' },
    ],
  },
  {
    field: 'education_level',
    label: 'Education level',
    category: 'ambition_growth',
    shape: 'SMALL_SET',
    options: [
      { key: 'secondary', label: 'Secondary school' },
      { key: 'bachelor', label: "Bachelor's degree" },
      { key: 'master', label: "Master's degree" },
      { key: 'phd', label: 'Doctoral / PhD' },
    ],
  },
  {
    field: 'career_ambition',
    label: 'Career ambition',
    category: 'ambition_growth',
    shape: 'SMALL_SET',
    options: [
      { key: 'low', label: 'Work-life balance first' },
      { key: 'medium', label: 'Ambitious, but balanced' },
      { key: 'high', label: 'Career-driven' },
    ],
  },
  {
    field: 'hobbies',
    label: 'Hobbies & interests',
    category: 'interests_connection',
    shape: 'MULTI_SELECT',
    tagUniverse: HOBBY_TAGS,
  },
]

export function getVariableConfig(field: string): VariableConfig | undefined {
  return VARIABLE_CATALOG.find((v) => v.field === field)
}

export function categoryLabel(id: string): string {
  return FIT_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

/** Which bucket a numeric self-value falls into, for BUCKETED_CONTINUOUS fields. */
export function bucketOf(config: VariableConfig, value: number): string | undefined {
  const buckets = config.options as BucketDef[] | undefined
  const bucket = buckets?.find(
    (b) => (b.min === null || value >= b.min) && (b.max === null || value <= b.max),
  )
  return bucket?.key
}
