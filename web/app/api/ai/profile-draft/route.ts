import { NextResponse } from 'next/server'
import { DraftValidationError, generateProfileDraft } from '@/lib/ai/profileDraft'
import { checkRateLimit } from '@/lib/ai/rateLimit'
import { getOrCreateSessionId } from '@/lib/server/session'

export const runtime = 'nodejs'

/**
 * POST /api/ai/profile-draft  { rawText, existingTags? }
 *
 * Secure-backend AI generation: no key ever reaches the client (the provider
 * key, when configured, is read from a server-only env var inside
 * lib/ai/profileDraft.ts), input is validated (15-1000 words) and rate
 * limited (5 requests / 10 min per session) before any model call, and every
 * error path returns a safe, structured JSON error instead of leaking
 * internals.
 */
export async function POST(req: Request) {
  const { id } = await getOrCreateSessionId()

  const { allowed, retryAfterSeconds } = checkRateLimit(id)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many draft requests — please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  let body: { rawText?: string; existingTags?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.rawText !== 'string') {
    return NextResponse.json({ error: '"rawText" is required' }, { status: 400 })
  }

  try {
    const draft = await generateProfileDraft({
      rawText: body.rawText,
      existingTags: Array.isArray(body.existingTags) ? body.existingTags : [],
    })
    return NextResponse.json(draft)
  } catch (err) {
    if (err instanceof DraftValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Draft generation failed — please try again.' }, { status: 500 })
  }
}
