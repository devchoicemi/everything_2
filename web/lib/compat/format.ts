import type { BucketDef, VariableConfig } from './types'
import { bucketOf } from './config'

/** Height is held and shown in centimetres everywhere. */
export const HEIGHT_MIN_CM = 120
export const HEIGHT_MAX_CM = 230

/** A member's own value for a field, as a short human-readable string ('' when unset). */
export function formatSelfValue(config: VariableConfig, self: unknown): string {
  if (self === null || self === undefined) return ''
  if (config.shape === 'BUCKETED_CONTINUOUS') {
    return config.field === 'height' ? `${self} cm` : String(self)
  }
  if (config.shape === 'MULTI_SELECT') {
    const list = self as string[]
    return list.length ? list.join(', ') : ''
  }
  const options = (config.options ?? []) as { key: string; label: string }[]
  return options.find((o) => o.key === self)?.label ?? ''
}

/** Label of the band a numeric self-value falls into (e.g. "170–179 cm"), for bucketed fields. */
export function bucketLabel(config: VariableConfig, value: number): string {
  const key = bucketOf(config, value)
  return (config.options as BucketDef[] | undefined)?.find((b) => b.key === key)?.label ?? ''
}
