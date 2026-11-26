import { getDb } from '../db'
import { cfg } from './config'
import { logBookingEvent, setStatus } from './events'
import { Outbox, dayText, notifyAdmin, notifyDater, notifyVenue, whenText } from './notify'
import { COLS, closeBooking, endBooking, rebook, type BookingRow } from './service'
import { startInstant, todayHelsinki } from './util'
import { hoursFor, loadRules, weekdayOf } from '../social/availability'

/**
 * The steps that happen because time passed, not because someone tapped. Run on a schedule (every few
 * minutes) through POST /api/v1/admin/tick, which a cron job calls with the TICK_SECRET. Each step is safe
 * to run twice: it rechecks the booking under a lock and records what it did.
 */
export interface SweepResult {
  reminded: number
  expired: number
  closed: number
  dayBefore: number
  twoHours: number
  autoEnded: number
  noShows: number
  feedbackReminders: number
}

const ids = async (sql: string, params: unknown[] = []): Promise<string[]> => {
  const db = await getDb()
  return (await db.query<{ id: string }>(sql, params)).rows.map((r) => r.id)
}

async function each(list: string[], fn: (q: import('../db').Queryable, b: BookingRow, out: Outbox) => Promise<boolean>): Promise<number> {
  const db = await getDb()
  let n = 0
  for (const id of list) {
    const out = new Outbox()
    const did = await db
      .tx(async (q) => {
        const { rows } = await q.query<BookingRow>(`select ${COLS} from bookings b where b.id = $1 for update`, [id])
        return rows[0] ? fn(q, rows[0], out) : false
      })
      .catch((e) => {
        console.error('[sweep] failed for booking', id, (e as Error).message)
        return false
      })
    if (did) n++
    await out.flush()
  }
  return n
}

export async function runSweeps(): Promise<SweepResult> {
  const c = cfg()
  const db = await getDb()
  const today = await todayHelsinki(db)
  const result: SweepResult = { reminded: 0, expired: 0, closed: 0, dayBefore: 0, twoHours: 0, autoEnded: 0, noShows: 0, feedbackReminders: 0 }

  // the date window passed with no date: close quietly, the same message to both
  result.closed = await each(await ids(`select id from bookings where status in ('proposed', 'picked') and window_end < $1::date`, [today]), async (q, b) => {
    if (b.status !== 'proposed' && b.status !== 'picked') return false
    await q.query(`update booking_options set status = 'expired' where booking_id = $1 and status in ('offered', 'picked')`, [b.id])
    await closeBooking(q, b, 'window_passed')
    return true
  })

  // 2: nobody sent options in time, one reminder only
  result.reminded = await each(await ids(`select id from bookings where status = 'proposed' and rounds = 0 and reminded_at is null and deadline_at < now()`), async (q, b) => {
    if (b.status !== 'proposed' || b.rounds !== 0 || b.reminded_at) return false
    await q.query('update bookings set reminded_at = now() where id = $1', [b.id])
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 2, code: 'options_reminder', title: 'Your date window is waiting', body: `Send 3 options before ${dayText(b.window_end)}. Whoever goes first sets the pace.` })
    }
    await logBookingEvent(q, b.id, 'reminder_sent', { actor: 'system' })
    return true
  })

  // 6: options not answered, or a picked option not confirmed, in time
  result.expired = await each(
    await ids(`select id from bookings where (status = 'proposed' and rounds > 0 or status = 'picked') and deadline_at < now()`),
    async (q, b) => {
      if (!((b.status === 'proposed' && b.rounds > 0) || b.status === 'picked') || !b.deadline_at || new Date(b.deadline_at).getTime() > Date.now()) return false
      await q.query(`update booking_options set status = 'expired' where booking_id = $1 and status in ('offered', 'picked')`, [b.id])
      await setStatus(q, b, 'expired', 'expired', { type: 'system' }, {}, { deadline_at: null, turn_user: null })
      for (const uid of [b.user_a, b.user_b]) {
        await notifyDater(q, { userId: uid, bookingId: b.id, no: 6, code: 'expired', title: 'These date options have expired', body: 'Nothing was sent to the venue. Either of you can plan again.' })
      }
      if (b.window_end >= (await todayHelsinki(q))) await rebook(q, b)
      else await q.query(`update bookings set closed_reason = 'window_passed' where id = $1`, [b.id])
      return true
    },
  )

  // 11: the venue missed its deadline: treated like a decline, repeated misses are flagged
  result.expired += await each(await ids(`select id from bookings where status = 'requested' and venue_deadline_at < now()`), async (q, b, out) => {
    if (b.status !== 'requested') return false
    await setStatus(q, b, 'expired', 'venue_missed_deadline', { type: 'system' }, {}, { venue_deadline_at: null })
    const v = (await q.query<{ name: string }>('select name from venues where id = $1', [b.venue_id])).rows[0]
    for (const uid of [b.user_a, b.user_b]) {
      await notifyDater(q, { userId: uid, bookingId: b.id, no: 11, code: 'venue_no_answer', title: `${v?.name ?? 'The venue'} can't host this time`, body: 'Plan another time or venue within your date window.' })
    }
    const misses = (await q.query<{ n: number }>(`select count(*)::int as n from booking_events e join bookings x on x.id = e.booking_id where x.venue_id = $1 and e.event = 'venue_missed_deadline' and e.at > now() - interval '30 days'`, [b.venue_id])).rows[0].n
    if (misses >= 2) await notifyAdmin(q, { bookingId: b.id, no: 11, code: 'venue_misses', title: 'A venue keeps missing its deadline', body: `${v?.name ?? b.venue_id} has not answered ${misses} requests in 30 days.` })
    await notifyVenue(q, out, { venueId: b.venue_id!, bookingId: b.id, no: 11, code: 'missed', title: `Request ${b.ref} expired`, body: 'The guests were told you could not host. Answer requests within the deadline to keep your slots.' })
    if (b.window_end >= (await todayHelsinki(q))) await rebook(q, b)
    return true
  })

  // 12: the day before, daters and the venue's portal
  result.dayBefore = await each(
    await ids(`select id from bookings where status = 'confirmed' and day_before_sent_at is null and start_at < now() + interval '24 hours' and start_at > now()`),
    async (q, b, out) => {
      if (b.status !== 'confirmed') return false
      await q.query('update bookings set day_before_sent_at = now() where id = $1', [b.id])
      const v = (await q.query<{ name: string }>('select name from venues where id = $1', [b.venue_id])).rows[0]
      for (const uid of [b.user_a, b.user_b]) {
        await notifyDater(q, { userId: uid, bookingId: b.id, no: 12, code: 'day_before', title: 'Your date is tomorrow', body: `${whenText(b.date_on!, b.start_time!)} at ${v?.name}. Reference ${b.ref}.` })
      }
      await notifyVenue(q, out, { venueId: b.venue_id!, bookingId: b.id, no: 12, code: 'day_before', title: `Tomorrow: ${b.ref}`, body: `${whenText(b.date_on!, b.start_time!)}, party of 2.` })
      return true
    },
  )

  // 13: two hours before, daters
  result.twoHours = await each(
    await ids(`select id from bookings where status = 'confirmed' and two_hours_sent_at is null and start_at < now() + interval '2 hours' and start_at > now()`),
    async (q, b) => {
      if (b.status !== 'confirmed') return false
      await q.query('update bookings set two_hours_sent_at = now() where id = $1', [b.id])
      const v = (await q.query<{ name: string }>('select name from venues where id = $1', [b.venue_id])).rows[0]
      for (const uid of [b.user_a, b.user_b]) {
        await notifyDater(q, { userId: uid, bookingId: b.id, no: 13, code: 'two_hours', title: 'Your date is in 2 hours', body: `${b.start_time} at ${v?.name}. Open your date card to see the entrance photo and your QR code.` })
      }
      return true
    },
  )

  // auto-close a running date nobody confirmed ended: at the venue's closing time that day, or 6 hours after it started
  result.autoEnded = await each(await ids(`select id from bookings where status = 'in_progress'`), async (q, b) => {
    if (b.status !== 'in_progress' || !b.date_on || !b.started_at) return false
    let deadline = new Date(b.started_at).getTime() + 6 * 3_600_000
    const rules = b.venue_id ? await loadRules(q, b.venue_id) : null
    const h = rules ? hoursFor(rules, weekdayOf(b.date_on)) : null
    if (h) deadline = (await startInstant(q, b.date_on, h.close)).getTime()
    if (Date.now() < Math.max(deadline, new Date(b.started_at).getTime() + 30 * 60_000)) return false
    await endBooking(q, b, 'auto', { type: 'system' })
    return true
  })

  // never left in limbo: a confirmed date nobody came to, or half-checked-in for a day, is recorded as a no-show
  result.noShows = await each(
    await ids(`select id from bookings where status in ('confirmed', 'partially_checked_in') and start_at < now() - interval '24 hours'`),
    async (q, b) => {
      if (b.status !== 'confirmed' && b.status !== 'partially_checked_in') return false
      let absent: string | null = null
      if (b.status === 'partially_checked_in') {
        absent = (await q.query<{ user_id: string }>('select user_id from booking_guests where booking_id = $1 and checked_in_at is null', [b.id])).rows[0]?.user_id ?? null
      }
      await setStatus(q, b, 'no_show', 'no_show_auto', { type: 'system' }, { absent }, { no_show_at: new Date(), no_show_by: 'venue', no_show_user: absent })
      await notifyAdmin(q, { bookingId: b.id, no: 20, code: 'no_show', title: 'No-show (nobody marked it)', body: `${b.ref} was never closed out by the venue, so it was recorded automatically.` })
      return true
    },
  )

  // 18: no rating after 24 hours, once
  result.feedbackReminders = await each(
    await ids(
      `select id from bookings where status = 'ended' and feedback_reminded_at is null and ended_at < now() - ($1 || ' hours')::interval and ended_at > now() - ($2 || ' days')::interval`,
      [String(c.feedbackReminderHours), String(c.feedbackDays)],
    ),
    async (q, b) => {
      await q.query('update bookings set feedback_reminded_at = now() where id = $1', [b.id])
      const todo = await q.query<{ user_id: string }>(
        `select u.id as user_id from users u where u.id in ($1::uuid, $2::uuid) and not exists (select 1 from booking_feedback f where f.booking_id = $3 and f.user_id = u.id)`,
        [b.user_a, b.user_b, b.id],
      )
      for (const r of todo.rows) await notifyDater(q, { userId: r.user_id, bookingId: b.id, no: 18, code: 'rate_reminder', title: 'Still time to rate your date', body: 'It takes a minute and helps ChoiceMi.' })
      return todo.rows.length > 0
    },
  )

  return result
}
