import type { Queryable } from '../db'
import { ApiError } from '../auth/http'
import { cfg } from '../booking/config'
import { BOOKING_SLOTS, formatSlotLabel, parseTime } from '@/lib/booking'

/**
 * When a venue can take a date: the one place that decides it, used by daters choosing options and by the
 * venue's own settings. A time is bookable when the venue is active, open that weekday, the date starts
 * early enough before closing (90 minutes by default), the venue offers that start time, no closure
 * covers it, and a table is still free.
 */
export interface DayHours {
  open: string
  close: string
}

export interface VenueRules {
  id: string
  capacity: number
  status: 'pending' | 'active' | 'paused'
  /** 0 = Sunday .. 6 = Saturday */
  open_days: number[]
  slot_times: string[]
  /** opening hours per weekday, keyed "0".."6" */
  hours: Record<string, DayHours>
}

export type SlotReason = 'closed' | 'not_offered' | 'full' | 'too_close_to_closing'

export interface SlotState {
  time: string
  label: string
  available: boolean
  reason?: SlotReason
}

/** The weekday (0 = Sunday) of a plain YYYY-MM-DD date. The day has no time zone of its own. */
export function weekdayOf(dateOn: string): number {
  const [y, m, d] = dateOn.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const minutesOf = (t: string): number => {
  const p = parseTime(t)
  return p ? p.hour * 60 + p.minute : -1
}

export async function loadRules(q: Queryable, venueId: string, lock = false): Promise<VenueRules | null> {
  const { rows } = await q.query<VenueRules>(
    `select id, capacity, status, open_days, slot_times, hours from venues where id = $1 and active ${lock ? 'for update' : ''}`,
    [venueId],
  )
  return rows[0] ?? null
}

/** The hours that apply on a weekday, from the venue's hours (falling back to its open days for older venues). */
export function hoursFor(rules: VenueRules, weekday: number): DayHours | null {
  const h = rules.hours?.[String(weekday)]
  if (h && h.open && h.close) return h
  if (Object.keys(rules.hours ?? {}).length === 0 && rules.open_days.includes(weekday)) return { open: '10:00', close: '22:00' }
  return null
}

/** Dates holding a table at a venue on a day, per start time. A table is held from the moment the request reaches the venue. */
async function used(q: Queryable, venueId: string, dateOn: string, excludeBookingId?: string): Promise<Map<string, number>> {
  const { rows } = await q.query<{ start_time: string; n: number }>(
    `select start_time, count(*)::int as n from bookings
      where venue_id = $1 and date_on = $2::date and status in ('requested', 'confirmed', 'partially_checked_in', 'in_progress')
        and ($3::uuid is null or id <> $3::uuid)
      group by start_time`,
    [venueId, dateOn, excludeBookingId ?? null],
  )
  return new Map(rows.map((r) => [r.start_time, r.n]))
}

interface Closure {
  start: number | null
  end: number | null
}

async function closuresOn(q: Queryable, venueId: string, dateOn: string): Promise<Closure[]> {
  const { rows } = await q.query<{ start_time: string | null; end_time: string | null }>('select start_time, end_time from venue_closures where venue_id = $1 and date_on = $2::date', [venueId, dateOn])
  return rows.map((r) => ({ start: r.start_time ? minutesOf(r.start_time) : null, end: r.end_time ? minutesOf(r.end_time) : null }))
}

const coversTime = (c: Closure, t: number) => (c.start === null ? true : t >= c.start && (c.end === null || t < c.end))

export async function slotStates(q: Queryable, rules: VenueRules, dateOn: string, excludeBookingId?: string): Promise<SlotState[]> {
  const [taken, closures] = await Promise.all([used(q, rules.id, dateOn, excludeBookingId), closuresOn(q, rules.id, dateOn)])
  const hours = rules.status === 'active' ? hoursFor(rules, weekdayOf(dateOn)) : null
  const lastStart = hours ? minutesOf(hours.close) - cfg().lastStartBeforeCloseMin : -1
  return BOOKING_SLOTS.map((time) => {
    const base = { time, label: formatSlotLabel(time) }
    const t = minutesOf(time)
    if (!hours || t < minutesOf(hours.open) || closures.some((c) => coversTime(c, t))) return { ...base, available: false, reason: 'closed' as const }
    if (t > lastStart) return { ...base, available: false, reason: 'too_close_to_closing' as const }
    if (!rules.slot_times.includes(time)) return { ...base, available: false, reason: 'not_offered' as const }
    if ((taken.get(time) ?? 0) >= rules.capacity) return { ...base, available: false, reason: 'full' as const }
    return { ...base, available: true }
  })
}

/** Throws the right error if this venue cannot take a date at this day and time. */
export async function assertBookable(q: Queryable, rules: VenueRules, dateOn: string, time: string, excludeBookingId?: string): Promise<void> {
  const slot = (await slotStates(q, rules, dateOn, excludeBookingId)).find((s) => s.time === time)
  if (!slot) throw new ApiError(400, 'invalid_time', 'That is not one of the offered times.')
  if (slot.available) return
  if (slot.reason === 'full') throw new ApiError(409, 'slot_full', 'That time is fully booked. Pick another.')
  throw new ApiError(409, 'venue_closed', 'This venue is not taking dates at that time. Pick another.')
}
