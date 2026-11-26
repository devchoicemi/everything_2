import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Colour a compatibility score the way the reference design does. */
export function scoreColor(p: number): string {
  if (p >= 85) return 'var(--t5)'
  if (p >= 75) return 'var(--t4)'
  return 'var(--t2)'
}

/** Expiry urgency band for match cards. */
export function expiryBand(days: number): 'urgent' | 'warn' | 'ok' {
  if (days <= 2) return 'urgent'
  if (days <= 4) return 'warn'
  return 'ok'
}

export function pluralise(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural ?? `${singular}s`
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/**
 * "Today" for the calendars. Real accounts use the real date (local midnight); the offline demo keeps
 * a pinned day so its seeded calendar data lines up.
 */
export const DEMO_TODAY = (() => {
  if (process.env.NEXT_PUBLIC_STANDALONE === '1') return new Date(2026, 2, 20)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
})()

export interface CalendarCell {
  day: number
  inMonth: boolean
  isToday: boolean
  isPast: boolean
  key: string
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1)
  let dow = first.getDay()
  dow = dow === 0 ? 6 : dow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const total = Math.ceil((dow + daysInMonth) / 7) * 7

  const cells: CalendarCell[] = []
  let dc = 1
  let nc = 1
  for (let i = 0; i < total; i++) {
    if (i < dow) {
      const day = daysInPrev - dow + 1 + i
      cells.push({ day, inMonth: false, isToday: false, isPast: true, key: '' })
    } else if (dc <= daysInMonth) {
      const day = dc++
      const date = new Date(year, month, day)
      const isToday =
        year === DEMO_TODAY.getFullYear() &&
        month === DEMO_TODAY.getMonth() &&
        day === DEMO_TODAY.getDate()
      const isPast = date < DEMO_TODAY && !isToday
      cells.push({
        day,
        inMonth: true,
        isToday,
        isPast,
        key: `${year}-${month + 1}-${day}`,
      })
    } else {
      const day = nc++
      cells.push({ day, inMonth: false, isToday: false, isPast: false, key: '' })
    }
  }
  return cells
}

export function distanceLabel(step: number): string {
  return (
    ['', 'Within 5 km', 'Within 20 km', 'Within 50 km', 'Within 100 km', 'Anywhere in Finland'][
      step
    ] ?? 'Within 20 km'
  )
}
