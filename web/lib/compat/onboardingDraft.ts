import { VARIABLE_CATALOG } from './config'
import type { CompatVariableInput, IdealValue, SelfValue, VariableConfig } from './types'

/** Client-side working copy of a variable before it's known to be complete/valid. */
export interface DraftVariable {
  field: string
  self: SelfValue | null
  ideal: IdealValue
  weight: number
  dealbreaker: boolean
}

export type CompatDraft = Record<string, DraftVariable>

export function emptyCompatDraft(): CompatDraft {
  const draft: CompatDraft = {}
  for (const v of VARIABLE_CATALOG) {
    draft[v.field] = {
      field: v.field,
      self: null,
      ideal: v.shape === 'MULTI_SELECT' ? [] : {},
      weight: 50,
      dealbreaker: false,
    }
  }
  return draft
}

export function isVariableComplete(config: VariableConfig, variable: DraftVariable): boolean {
  if (variable.self === null || variable.self === undefined) return false
  if (config.shape === 'MULTI_SELECT') {
    return Array.isArray(variable.self) && variable.self.length > 0
  }
  const ideal = variable.ideal as Record<string, number>
  const options = config.options ?? []
  return options.every((opt) => typeof ideal[opt.key] === 'number')
}

export function draftProgress(draft: CompatDraft): { complete: number; total: number } {
  let complete = 0
  for (const config of VARIABLE_CATALOG) {
    if (isVariableComplete(config, draft[config.field])) complete++
  }
  return { complete, total: VARIABLE_CATALOG.length }
}

export function dealbreakerCountInCategory(draft: CompatDraft, category: string): number {
  return VARIABLE_CATALOG.filter((v) => v.category === category && draft[v.field]?.dealbreaker).length
}

/** Converts a complete draft into the payload the API expects. Throws if incomplete — call isVariableComplete first. */
export function draftToPayload(draft: CompatDraft): CompatVariableInput[] {
  return VARIABLE_CATALOG.map((config) => {
    const d = draft[config.field]
    return {
      field: config.field,
      self: d.self as SelfValue,
      ideal: d.ideal,
      weight: d.weight,
      dealbreaker: d.dealbreaker,
    }
  })
}
