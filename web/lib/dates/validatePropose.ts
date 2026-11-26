import { isValidBookingStartTime } from '@/lib/booking'

/**
 * Pure request-body validation for POST /api/dates/propose, split out of the
 * route handler so it can be unit-tested without a Next.js request context
 * (the route itself also needs `next/headers` for the session cookie, which
 * only works inside a real request).
 *
 * Structurally enforces "no typing during the connection process": the
 * allow-list has no message/note field, and a request carrying one is
 * rejected outright rather than silently dropped.
 */

const ALLOWED_KEYS = new Set(['targetId', 'dateKey', 'time', 'venue'])

export interface ProposeFields {
  targetId: string
  dateKey: string
  time: string
  venue: string
}

export type ProposeValidation =
  | ({ ok: true } & ProposeFields)
  | { ok: false; status: number; error: string }

export function validateProposeBody(body: Record<string, unknown>): ProposeValidation {
  const unknownKeys = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k))

  if (unknownKeys.includes('note') || unknownKeys.includes('message')) {
    return {
      ok: false,
      status: 400,
      error: 'No message field is allowed at this stage — ChoiceMi has no chat before a date is confirmed.',
    }
  }
  if (unknownKeys.length) {
    return { ok: false, status: 400, error: `Unrecognised field(s): ${unknownKeys.join(', ')}` }
  }

  const { targetId, dateKey, time, venue } = body as Partial<Record<keyof ProposeFields, unknown>>

  if (!targetId || typeof targetId !== 'string') {
    return { ok: false, status: 400, error: '"targetId" is required' }
  }
  if (!dateKey || typeof dateKey !== 'string') {
    return { ok: false, status: 400, error: '"dateKey" is required' }
  }
  if (!venue || typeof venue !== 'string') {
    return { ok: false, status: 400, error: '"venue" is required' }
  }
  if (!time || typeof time !== 'string' || !isValidBookingStartTime(time)) {
    return {
      ok: false,
      status: 400,
      error: 'Date proposals can only start between 12:00pm and 7:00pm venue-local time.',
    }
  }

  return { ok: true, targetId, dateKey, time, venue }
}
