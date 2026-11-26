import type { Queryable } from '../db'
import { ApiError } from '../auth/http'
import { VENUE_TIMEZONE } from '@/lib/booking'

export const UUID = /^[0-9a-f-]{36}$/i

/** "2026-3-9" or "2026-03-09" to "2026-03-09", or null when it is not a real calendar day. */
export function normaliseDateKey(key: unknown): string | null {
  if (typeof key !== 'string') return null
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Today in Helsinki, as YYYY-MM-DD. */
export async function todayHelsinki(q: Queryable): Promise<string> {
  const { rows } = await q.query<{ d: string }>(`select to_char((now() at time zone $1)::date, 'YYYY-MM-DD') as d`, [VENUE_TIMEZONE])
  return rows[0].d
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** The instant a venue-local day and time starts. */
export async function startInstant(q: Queryable, dateOn: string, time: string): Promise<Date> {
  const { rows } = await q.query<{ t: Date }>(`select (($1::date + $2::text::time) at time zone $3) as t`, [dateOn, time, VENUE_TIMEZONE])
  return new Date(rows[0].t)
}

export function need<T>(v: T | undefined | null, status: number, code: string, message: string): T {
  if (v === undefined || v === null) throw new ApiError(status, code, message)
  return v
}

export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000)
