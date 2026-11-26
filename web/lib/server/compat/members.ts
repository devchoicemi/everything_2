import { getDb, type Queryable } from '../db'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { validateUserVariables, type ValidationError } from '@/lib/compat/engine'
import type { CompatVariableInput, UserCompatProfile } from '@/lib/compat/types'

/** Does this set cover every variable in the catalog? (A profile is only scoreable when it does.) */
export function isCompleteSet(variables: { field: string }[]): boolean {
  const have = new Set(variables.map((v) => v.field))
  return VARIABLE_CATALOG.every((c) => have.has(c.field))
}

interface Row {
  user_id: string
  field: string
  self: unknown
  ideal: unknown
  weight: number
  dealbreaker: boolean
}

const toInput = (r: Row): CompatVariableInput => ({
  field: r.field,
  self: r.self as CompatVariableInput['self'],
  ideal: r.ideal as CompatVariableInput['ideal'],
  weight: r.weight,
  dealbreaker: r.dealbreaker,
})

/** The saved compatibility inputs of several members at once, keyed by user id. */
export async function loadCompatProfiles(q: Queryable, userIds: string[]): Promise<Map<string, UserCompatProfile>> {
  const out = new Map<string, UserCompatProfile>()
  if (userIds.length === 0) return out
  const { rows } = await q.query<Row>(
    'select user_id, field, self, ideal, weight, dealbreaker from compat_variables where user_id = any($1::uuid[]) order by user_id, field',
    [userIds],
  )
  for (const r of rows) {
    const p = out.get(r.user_id) ?? { userId: r.user_id, variables: [] }
    p.variables.push(toInput(r))
    out.set(r.user_id, p)
  }
  return out
}

/** One member's compatibility profile, only if it is complete. */
export async function loadCompleteProfile(q: Queryable, userId: string): Promise<UserCompatProfile | null> {
  const p = (await loadCompatProfiles(q, [userId])).get(userId)
  return p && isCompleteSet(p.variables) ? p : null
}

/**
 * Validates (every rule in the spec: weight 10-100, at most 2 dealbreakers per category, every
 * option rated) and saves the member's inputs, replacing any earlier ones.
 */
export async function saveCompatProfile(
  userId: string,
  variables: CompatVariableInput[],
): Promise<{ ok: true } | { ok: false; errors: ValidationError[] }> {
  const errors = validateUserVariables(variables)
  const fields = new Set(variables.map((v) => v.field))
  for (const c of VARIABLE_CATALOG) if (!fields.has(c.field)) errors.push({ field: c.field, message: `"${c.label}" is missing` })
  if (fields.size !== variables.length) errors.push({ field: '*', message: 'each variable may appear only once' })
  const unsetSelf = variables.filter((v) => v.self === null || v.self === undefined || (Array.isArray(v.self) && v.self.length === 0))
  for (const v of unsetSelf) errors.push({ field: v.field, message: 'your own value is required' })
  if (errors.length) return { ok: false, errors }

  const db = await getDb()
  await db.tx(async (q) => {
    await q.query('delete from compat_variables where user_id = $1', [userId])
    for (const v of variables) {
      await q.query(
        `insert into compat_variables (user_id, field, self, ideal, weight, dealbreaker)
         values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)`,
        [userId, v.field, JSON.stringify(v.self), JSON.stringify(v.ideal), v.weight, v.dealbreaker],
      )
    }
  })
  return { ok: true }
}
