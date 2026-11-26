/**
 * Domain types for the ChoiceMi compatibility engine.
 *
 * Implements the confirmed "self-vs-ideal" model from
 * ChoiceMi_Compatibility_Scoring_Logic.md. This module is intentionally pure
 * and framework-free — it is exercised directly by tests and by the
 * `/api/compatibility/[a]/[b]` route, never by the client.
 *
 * The profile-reading verification gate (lib/verification/*) is a completely
 * separate system and must never be imported here.
 */

export type VariableShape = 'SMALL_SET' | 'BUCKETED_CONTINUOUS' | 'MULTI_SELECT'

export interface FitCategory {
  id: string
  label: string
  sortOrder: number
}

export interface OptionDef {
  key: string
  label: string
}

/** For BUCKETED_CONTINUOUS fields: a numeric self-value falls into exactly one bucket. */
export interface BucketDef extends OptionDef {
  /** inclusive lower bound; null = unbounded below */
  min: number | null
  /** inclusive upper bound; null = unbounded above */
  max: number | null
}

export interface VariableConfig {
  field: string
  label: string
  category: string
  shape: VariableShape
  /** SMALL_SET options, or BUCKETED_CONTINUOUS bands (§3.1 / §3.2) */
  options?: OptionDef[] | BucketDef[]
  /** MULTI_SELECT tag universe (§3.3) */
  tagUniverse?: string[]
}

/** One user's stored self-value for a field. Enum key, or a number for bucketed fields. */
export type SelfValue = string | number | string[]

/** One user's ideal rating for a field. */
export type IdealValue =
  | Record<string, number> // SMALL_SET / BUCKETED_CONTINUOUS: option-key -> 0-100
  | string[] // MULTI_SELECT: the ideal set

export interface CompatVariableInput {
  field: string
  self: SelfValue
  ideal: IdealValue
  /** 10-100, set by the variable's owner */
  weight: number
  dealbreaker: boolean
}

/** A user's complete set of compatibility inputs. */
export interface UserCompatProfile {
  userId: string
  variables: CompatVariableInput[]
}

export type MatchLabel =
  | 'perfect'
  | 'strong'
  | 'partial'
  | 'weak'
  | 'none'
  | 'dealbreaker'

export interface VariableBreakdown {
  field: string
  label: string
  category: string
  score: number
  weight: number
  effectiveWeight: number
  dealbreaker: boolean
  label_: MatchLabel
  /** true when the variable was excluded from this direction's denominator (see §11 "incomplete profiles") */
  excluded: boolean
  excludedReason?: 'target_self_unset' | 'viewer_ideal_incomplete'
}

export interface DirectionalResult {
  percent: number
  breakdown: VariableBreakdown[]
}

export interface CategoryResult {
  category: string
  label: string
  percent: number
}

export interface CompatibilityResult {
  final: number
  byCategory: CategoryResult[]
  aToB: DirectionalResult
  bToA: DirectionalResult
}
