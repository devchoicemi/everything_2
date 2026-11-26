/**
 * Booking-hours policy (requirement: 12:00pm–7:00pm venue-local start times).
 *
 * All pilot venues are in Helsinki, so `VENUE_TIMEZONE` is a single constant
 * today; a multi-city future would key it per venue instead.
 *
 * On daylight saving: the rule is stated in *venue-local wall-clock time*
 * ("12:00 p.m. through 7:00 p.m. local venue time") — DST only changes a
 * location's UTC offset, never its own wall clock, so "12:00–19:00 local"
 * means exactly the same thing the day before and the day after a DST
 * transition. There is nothing to convert: we validate the local HH:mm the
 * venue would show on its own wall clock, which is DST-orthogonal by
 * construction. (This would matter if we ever computed reminder times in UTC
 * — that is a separate, unbuilt feature — but it does not affect this rule.)
 */

export const VENUE_TIMEZONE = 'Europe/Helsinki'
export const BOOKING_START_HOUR = 12
export const BOOKING_END_HOUR = 19 // 7:00pm is a valid start time; nothing after it is

/** Fixed set of offered start-time slots, 12:00–19:00 inclusive, at a friendly cadence. */
export const BOOKING_SLOTS = ['12:00', '13:30', '15:00', '16:30', '18:00', '19:00'] as const

export type BookingSlot = (typeof BOOKING_SLOTS)[number]

/** Parses "H:MM" / "HH:MM" (24h) into { hour, minute }. Returns null if malformed. */
export function parseTime(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/**
 * True if `value` (24h "HH:mm", venue-local) is a valid booking start time:
 * from 12:00 up to and including 19:00. This is the structural check — it
 * does not merely whitelist BOOKING_SLOTS, so a future free-entry time
 * picker stays governed by the same rule without extra work.
 */
export function isValidBookingStartTime(value: string): boolean {
  const parsed = parseTime(value)
  if (!parsed) return false
  const totalMinutes = parsed.hour * 60 + parsed.minute
  return totalMinutes >= BOOKING_START_HOUR * 60 && totalMinutes <= BOOKING_END_HOUR * 60
}

/** 24h "HH:mm" → "h:mma" for display, e.g. "13:30" → "1:30pm". */
export function formatSlotLabel(value: string): string {
  const parsed = parseTime(value)
  if (!parsed) return value
  const period = parsed.hour >= 12 ? 'pm' : 'am'
  const hour12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12
  const minute = parsed.minute === 0 ? '' : `:${String(parsed.minute).padStart(2, '0')}`
  return `${hour12}${minute}${period}`
}
