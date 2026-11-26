import { mutateTable, readTable } from '@/lib/server/jsonStore'
import { validateUserVariables } from './engine'
import { getSeedCompatProfile } from './seed'
import type { CompatVariableInput, UserCompatProfile } from './types'

const TABLE = 'compat_profiles'

type StoredTable = Record<string, CompatVariableInput[]>

/**
 * Resolves a user's compatibility profile: a saved (onboarding-submitted) set
 * of variables takes precedence over the seed persona, so completing the
 * real onboarding flow genuinely changes your match scores against the
 * demo profiles.
 */
export function getUserCompatProfile(userId: string): UserCompatProfile | undefined {
  const table = readTable<StoredTable>(TABLE, {})
  if (table[userId]) return { userId, variables: table[userId] }
  return getSeedCompatProfile(userId)
}

export async function saveUserCompatProfile(
  userId: string,
  variables: CompatVariableInput[],
): Promise<{ ok: true } | { ok: false; errors: { field: string; message: string }[] }> {
  const errors = validateUserVariables(variables)
  if (errors.length) return { ok: false, errors }

  await mutateTable<StoredTable>(TABLE, {}, (table) => {
    table[userId] = variables
    return table
  })
  return { ok: true }
}
