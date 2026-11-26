import { NextResponse } from 'next/server'
import { validateProposeBody } from '@/lib/dates/validatePropose'
import { ensureLegacyDemoMatchPassed, hasPassedGate } from '@/lib/verification/gate'
import { getOrCreateSessionId } from '@/lib/server/session'
import { mutateTable } from '@/lib/server/jsonStore'
import { LEGACY_MATCH_IDS } from '@/lib/mock-data'
import type { ProposeFields } from '@/lib/dates/validatePropose'
import { offlineOnly } from '@/lib/server/offlineOnly'

export const runtime = 'nodejs'

interface StoredProposal extends ProposeFields {
  id: string
  proposerId: string
  createdAt: number
  status: 'pending'
}

const TABLE = 'date_proposals'

/**
 * POST /api/dates/propose  { targetId, dateKey, time, venue }
 *
 * Deliberately has NO message/note field (requirement: no typing during the
 * connection process) — enforced structurally in validateProposeBody, which
 * rejects any request carrying one rather than silently dropping it.
 *
 * Also enforces, server-side, two gates a UI-only check can't guarantee:
 *   1. The reader must have PASSED the profile-reading verification gate for
 *      this target (requirement 4 — a page refresh cannot bypass this: this
 *      check runs no matter what the client believes).
 *   2. The requested start time must fall within the 12:00–19:00 venue-local
 *      booking window (requirement 6).
 */
export async function POST(req: Request) {
  const off = offlineOnly()
  if (off) return off
  const { id: proposerId } = await getOrCreateSessionId()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = validateProposeBody(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status })
  }
  const { targetId, dateKey, time, venue } = validation

  await ensureLegacyDemoMatchPassed(proposerId, targetId, LEGACY_MATCH_IDS)

  if (!hasPassedGate(proposerId, targetId)) {
    return NextResponse.json(
      { error: 'Read this profile and pass the read-check before proposing a date.' },
      { status: 403 },
    )
  }

  const proposal: StoredProposal = {
    id: `${proposerId}-${targetId}-${Date.now()}`,
    proposerId,
    targetId,
    dateKey,
    time,
    venue,
    status: 'pending',
    createdAt: Date.now(),
  }

  await mutateTable<Record<string, StoredProposal>>(TABLE, {}, (table) => {
    table[proposal.id] = proposal
    return table
  })

  return NextResponse.json({ ok: true, proposal })
}
