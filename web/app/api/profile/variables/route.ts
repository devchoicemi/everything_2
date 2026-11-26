import { NextResponse } from 'next/server'
import { getUserCompatProfile, saveUserCompatProfile } from '@/lib/compat/store'
import { getOrCreateSessionId } from '@/lib/server/session'
import type { CompatVariableInput } from '@/lib/compat/types'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

/** GET → the current session's saved compatibility variables (or the seed default for "me"). */
export async function GET() {
  const off = offlineOnly()
  if (off) return off
  const { id } = await getOrCreateSessionId()
  const profile = getUserCompatProfile(id) ?? getUserCompatProfile('me')
  return NextResponse.json(profile ?? { userId: id, variables: [] })
}

/**
 * POST { variables: CompatVariableInput[] } — validates and persists the
 * signed-in demo user's compatibility inputs. Every constraint from the
 * spec (weight 10-100, ≤2 dealbreakers/category, full option coverage) is
 * re-checked server-side — the client-side onboarding UI enforces the same
 * rules, but this is the actual source of truth.
 */
export async function POST(req: Request) {
  const off = offlineOnly()
  if (off) return off
  const { id } = await getOrCreateSessionId()
  let body: { variables?: CompatVariableInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.variables)) {
    return NextResponse.json({ error: '"variables" must be an array' }, { status: 400 })
  }

  const result = await saveUserCompatProfile(id, body.variables)
  if (!result.ok) {
    return NextResponse.json({ error: 'Validation failed', details: result.errors }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}
