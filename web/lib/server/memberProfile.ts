import { getDb } from './db'
import { ApiError } from './auth/http'
import { rateLimit } from './auth/rateLimit'
import { assessStory } from '@/lib/profile/quality'
import { seedIfEmpty } from './questionPool'

const ALLOWED_KEYS = ['onboarding', 'compatDraft', 'aiDraft', 'poolPicks'] as const
const MAX_BYTES = 120_000
/** Readers are quizzed on these, so setup is not finished without enough real ones. */
export const MIN_READ_CHECK_PICKS = 4

export interface StoredProfile {
  onboarded: boolean
  data: Record<string, unknown>
}

export async function getMemberProfile(userId: string): Promise<StoredProfile> {
  const db = await getDb()
  const { rows } = await db.query<{ data: Record<string, unknown>; onboarded_at: Date | null }>(
    'select data, onboarded_at from member_profiles where user_id = $1',
    [userId],
  )
  const r = rows[0]
  return { onboarded: Boolean(r?.onboarded_at), data: r?.data ?? {} }
}

/**
 * Saves the member's profile. Only the known parts are kept. `complete: true` marks setup as
 * finished, and needs the explicit consent for sensitive details to be on record.
 */
export async function saveMemberProfile(userId: string, body: Record<string, unknown>): Promise<StoredProfile> {
  await rateLimit('profile-save', userId, 240, 3600)
  const incoming = body.data
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new ApiError(400, 'invalid_request', 'Send { data: {...} }.')
  }
  const data: Record<string, unknown> = {}
  for (const k of ALLOWED_KEYS) if (k in (incoming as Record<string, unknown>)) data[k] = (incoming as Record<string, unknown>)[k]
  const json = JSON.stringify(data)
  if (json.length > MAX_BYTES) throw new ApiError(413, 'too_large', 'That profile is too large.')

  const complete = body.complete === true
  if (complete) {
    // Same rules as the screen: real answers, not filler. Older clients send only rawText.
    const ai = (data.aiDraft ?? {}) as { prompts?: Record<string, string>; extra?: string; rawText?: string }
    const hasPrompts = ai.prompts && typeof ai.prompts === 'object' && Object.values(ai.prompts).some((v) => typeof v === 'string' && v.trim())
    const story = assessStory({
      prompts: hasPrompts ? (ai.prompts as Record<string, string>) : {},
      extra: hasPrompts ? (ai.extra ?? '') : (ai.extra || ai.rawText || ''),
    })
    if (!story.ok) throw new ApiError(400, 'story_quality', story.message ?? 'Please answer the questions about yourself with real sentences.')
    const ob = data.onboarding as { consentSensitive?: boolean } | undefined
    if (ob?.consentSensitive !== true) {
      throw new ApiError(400, 'consent_required', 'Please confirm you agree to us using the sensitive details you gave, so we can match you.')
    }
    if ((await validPickCount(data.poolPicks)) < MIN_READ_CHECK_PICKS) {
      throw new ApiError(400, 'read_check_required', `Choose at least ${MIN_READ_CHECK_PICKS} read-check questions and the answers that are true for you.`)
    }
  }

  const db = await getDb()
  const { rows } = await db.query<{ onboarded_at: Date | null }>(
    `insert into member_profiles (user_id, data, onboarded_at)
     values ($1, $2::jsonb, case when $3::boolean then now() end)
     on conflict (user_id) do update
       set data = excluded.data,
           onboarded_at = coalesce(member_profiles.onboarded_at, excluded.onboarded_at),
           updated_at = now()
     returning onboarded_at`,
    [userId, json, complete],
  )
  return { onboarded: Boolean(rows[0].onboarded_at), data }
}

/** How many of the member's picks are real pool questions with an answer that is one of its choices. */
async function validPickCount(picks: unknown): Promise<number> {
  if (!Array.isArray(picks)) return 0
  const wanted = picks.filter((p): p is { id: string; answer: string } => typeof p?.id === 'string' && typeof p?.answer === 'string')
  if (wanted.length === 0) return 0
  await seedIfEmpty()
  const db = await getDb()
  const { rows } = await db.query<{ id: string; options: string[] }>('select id, options from question_pool where id = any($1::text[])', [wanted.map((p) => p.id)])
  const seen = new Set<string>()
  for (const p of wanted) {
    const row = rows.find((r) => r.id === p.id)
    if (row && row.options.includes(p.answer)) seen.add(p.id)
  }
  return seen.size
}
