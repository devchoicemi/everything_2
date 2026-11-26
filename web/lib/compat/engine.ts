/**
 * The compatibility scoring engine — a direct implementation of the
 * pseudocode in §10 of ChoiceMi_Compatibility_Scoring_Logic.md.
 *
 * Four things in the spec were explicitly left open (§11). Rather than
 * silently guessing, each is resolved here as a named, documented policy —
 * see docs/COMPATIBILITY_DECISIONS.md for the full rationale:
 *
 *  1. Unrated options  → NOT allowed to reach this engine at all:
 *     `validateUserVariables` requires every SMALL_SET/BUCKETED_CONTINUOUS
 *     option to be rated before a profile's variables can be saved. This is
 *     stricter than a silent default and keeps the confirmed formula intact.
 *  2. Dealbreaker ceiling → NOT implemented. The confirmed formula only
 *     doubles the weight (§5/§10) — no extra cap is applied. Flagged as open.
 *  3. Bucket boundaries → height is in centimetres with 4 plain bands (under 160,
 *     160-169, 170-179, 180+); age uses a
 *     documented-provisional 4-band split (config.ts). No other continuous
 *     fields are in the catalog yet.
 *  4. Incomplete profiles → a variable is EXCLUDED from a direction's sums
 *     (weight and score both omitted) when the *target* hasn't set a self
 *     value for that field, or when a MULTI_SELECT viewer ideal-set is empty.
 *     This is the "exclude entirely" alternative named in §11, chosen over
 *     counting missing data as a punitive 0.
 *
 * Pure and framework-free — no I/O, no Next.js imports. Exercised directly by
 * tests and by app/api/compatibility/[a]/[b]/route.ts.
 */

import { bucketOf, categoryLabel, getVariableConfig, VARIABLE_CATALOG } from './config'
import type {
  CategoryResult,
  CompatibilityResult,
  CompatVariableInput,
  DirectionalResult,
  MatchLabel,
  SelfValue,
  UserCompatProfile,
  VariableBreakdown,
} from './types'

export function matchLabel(score: number, dealbreaker: boolean): MatchLabel {
  if (dealbreaker) return 'dealbreaker'
  if (score >= 90) return 'perfect'
  if (score >= 70) return 'strong'
  if (score >= 40) return 'partial'
  if (score >= 1) return 'weak'
  return 'none'
}

export interface ValidationError {
  field: string
  message: string
}

/**
 * Server-side validation for a user's compatibility inputs before they are
 * persisted — enforces every constraint the spec calls out explicitly:
 * weight range, the 2-dealbreaker-per-category cap, and full option coverage
 * for SMALL_SET / BUCKETED_CONTINUOUS fields (policy #1 above).
 */
export function validateUserVariables(variables: CompatVariableInput[]): ValidationError[] {
  const errors: ValidationError[] = []
  const dealbreakersByCategory = new Map<string, number>()

  for (const v of variables) {
    const config = getVariableConfig(v.field)
    if (!config) {
      errors.push({ field: v.field, message: `Unknown variable "${v.field}"` })
      continue
    }

    if (!Number.isInteger(v.weight) || v.weight < 10 || v.weight > 100) {
      errors.push({ field: v.field, message: 'weight must be an integer between 10 and 100' })
    }

    if (v.dealbreaker) {
      dealbreakersByCategory.set(config.category, (dealbreakersByCategory.get(config.category) ?? 0) + 1)
    }

    if (config.shape === 'MULTI_SELECT') {
      const idealSet = v.ideal as string[]
      const selfSet = v.self as string[]
      if (!Array.isArray(idealSet)) {
        errors.push({ field: v.field, message: 'ideal must be an array of tag keys for a MULTI_SELECT field' })
      } else {
        const universe = new Set(config.tagUniverse ?? [])
        for (const tag of idealSet) {
          if (!universe.has(tag)) errors.push({ field: v.field, message: `"${tag}" is not a valid tag` })
        }
      }
      if (!Array.isArray(selfSet)) {
        errors.push({ field: v.field, message: 'self must be an array of tag keys for a MULTI_SELECT field' })
      }
    } else {
      const ideal = v.ideal as Record<string, number>
      const options = config.options ?? []
      for (const opt of options) {
        const rating = ideal?.[opt.key]
        if (rating === undefined || rating === null) {
          errors.push({
            field: v.field,
            message: `missing ideal rating for option "${opt.label}" — every option must be rated before saving (policy: no silent default for unrated options)`,
          })
        } else if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
          errors.push({ field: v.field, message: `ideal rating for "${opt.label}" must be 0-100` })
        }
      }
    }
  }

  for (const [category, count] of dealbreakersByCategory) {
    if (count > 2) {
      errors.push({ field: category, message: `at most 2 dealbreakers allowed per category (got ${count})` })
    }
  }

  return errors
}

/** score = ideal lookup (SMALL_SET / BUCKETED_CONTINUOUS) or overlap fraction (MULTI_SELECT). */
function variableScore(
  variable: CompatVariableInput,
  targetSelfValue: SelfValue | undefined,
): { score: number; excluded: boolean; reason?: 'target_self_unset' | 'viewer_ideal_incomplete' } {
  const config = getVariableConfig(variable.field)
  if (!config) return { score: 0, excluded: true, reason: 'target_self_unset' }

  if (targetSelfValue === undefined || targetSelfValue === null) {
    return { score: 0, excluded: true, reason: 'target_self_unset' }
  }

  if (config.shape === 'MULTI_SELECT') {
    const idealSet = variable.ideal as string[]
    if (!idealSet || idealSet.length === 0) {
      return { score: 0, excluded: true, reason: 'viewer_ideal_incomplete' }
    }
    const targetSet = new Set(targetSelfValue as string[])
    const overlap = idealSet.filter((t) => targetSet.has(t)).length
    return { score: (overlap / idealSet.length) * 100, excluded: false }
  }

  const idealMap = variable.ideal as Record<string, number>
  const key =
    config.shape === 'BUCKETED_CONTINUOUS'
      ? bucketOf(config, targetSelfValue as number)
      : (targetSelfValue as string)

  if (key === undefined || idealMap[key] === undefined) {
    // target's value doesn't map to any configured bucket/option — treat as unscoreable
    return { score: 0, excluded: true, reason: 'target_self_unset' }
  }

  return { score: idealMap[key], excluded: false }
}

/** One direction of the weighted average — over the *viewer's* variables, scored against target's self values. */
export function directionalPercent(
  viewer: UserCompatProfile,
  targetSelf: Record<string, SelfValue>,
): DirectionalResult {
  let earned = 0
  let possible = 0
  const breakdown: VariableBreakdown[] = []

  for (const variable of viewer.variables) {
    const config = getVariableConfig(variable.field)
    const { score, excluded, reason } = variableScore(variable, targetSelf[variable.field])
    const effectiveWeight = variable.dealbreaker ? variable.weight * 2 : variable.weight

    if (!excluded) {
      earned += effectiveWeight * score
      possible += effectiveWeight * 100
    }

    breakdown.push({
      field: variable.field,
      label: config?.label ?? variable.field,
      category: config?.category ?? 'unknown',
      score: Math.round(score * 10) / 10,
      weight: variable.weight,
      effectiveWeight,
      dealbreaker: variable.dealbreaker,
      label_: excluded ? 'none' : matchLabel(score, variable.dealbreaker),
      excluded,
      excludedReason: reason,
    })
  }

  const percent = possible > 0 ? (earned / possible) * 100 : 0
  return { percent: Math.round(percent * 10) / 10, breakdown }
}

function categoryPercentFromBreakdown(breakdown: VariableBreakdown[], category: string): number {
  const rows = breakdown.filter((b) => b.category === category && !b.excluded)
  if (rows.length === 0) return 0
  const earned = rows.reduce((s, r) => s + r.effectiveWeight * r.score, 0)
  const possible = rows.reduce((s, r) => s + r.effectiveWeight * 100, 0)
  return possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0
}

/** Full two-directional compatibility between two users — the shape returned by the API route. */
export function compatibilityScore(userA: UserCompatProfile, userB: UserCompatProfile): CompatibilityResult {
  const selfB = selfMap(userB)
  const selfA = selfMap(userA)

  const aToB = directionalPercent(userA, selfB)
  const bToA = directionalPercent(userB, selfA)

  const categoriesInvolved = new Set([
    ...aToB.breakdown.map((b) => b.category),
    ...bToA.breakdown.map((b) => b.category),
  ])

  const byCategory: CategoryResult[] = Array.from(categoriesInvolved)
    .map((category) => {
      const aSide = categoryPercentFromBreakdown(aToB.breakdown, category)
      const bSide = categoryPercentFromBreakdown(bToA.breakdown, category)
      return { category, label: categoryLabel(category), percent: Math.round(((aSide + bSide) / 2) * 10) / 10 }
    })
    .sort((x, y) => {
      const oa = VARIABLE_CATALOG.find((v) => v.category === x.category)
      const ob = VARIABLE_CATALOG.find((v) => v.category === y.category)
      return (oa ? 0 : 1) - (ob ? 0 : 1) || x.category.localeCompare(y.category)
    })

  const final = Math.round(((aToB.percent + bToA.percent) / 2) * 10) / 10

  return { final, byCategory, aToB, bToA }
}

function selfMap(user: UserCompatProfile): Record<string, SelfValue> {
  const map: Record<string, SelfValue> = {}
  for (const v of user.variables) map[v.field] = v.self
  return map
}
