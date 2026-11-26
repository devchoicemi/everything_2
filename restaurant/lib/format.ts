export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Monday first, the way a restaurant week reads. Values are 0 = Sunday .. 6 = Saturday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "15:00" to "3pm", "13:30" to "1:30pm". */
export function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`
}

/** Today in Helsinki as YYYY-MM-DD: the day a venue there is living in, wherever this browser is. */
export function todayHelsinki(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date())
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()

/** The Monday on or before a day. */
export function mondayOf(day: string): string {
  const w = weekdayOf(day)
  return addDays(day, w === 0 ? -6 : 1 - w)
}

/** "Sat 17 Oct". */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${WEEKDAYS_SHORT[weekdayOf(day)]} ${d} ${MONTHS[m - 1]}`
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
