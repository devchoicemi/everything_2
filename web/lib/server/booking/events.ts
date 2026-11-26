import type { Queryable } from '../db'
import type { BookingStatus } from './config'

export type ActorType = 'dater' | 'venue' | 'system' | 'admin'

/** Every status change, time-stamped. The staff dashboard reads this. */
export async function logBookingEvent(
  q: Queryable,
  bookingId: string,
  event: string,
  opts: { actor: ActorType; actorId?: string | null; from?: BookingStatus | null; to?: BookingStatus | null; meta?: Record<string, unknown> },
): Promise<void> {
  await q.query(
    'insert into booking_events (booking_id, actor_type, actor_id, from_status, to_status, event, meta) values ($1, $2, $3, $4, $5, $6, $7::jsonb)',
    [bookingId, opts.actor, opts.actorId ?? null, opts.from ?? null, opts.to ?? null, event, opts.meta ? JSON.stringify(opts.meta) : null],
  )
}

/** Moves a booking to a new status and records it, in one place so no change goes unlogged. */
export async function setStatus(
  q: Queryable,
  b: { id: string; status: BookingStatus },
  to: BookingStatus,
  event: string,
  actor: { type: ActorType; id?: string | null },
  extra: Record<string, unknown> = {},
  sets: Record<string, unknown> = {},
): Promise<void> {
  const cols = Object.keys(sets)
  const assignments = ['status = $2', 'updated_at = now()', ...cols.map((c, i) => `${c} = $${i + 3}`)]
  await q.query(`update bookings set ${assignments.join(', ')} where id = $1`, [b.id, to, ...cols.map((c) => sets[c])])
  await logBookingEvent(q, b.id, event, { actor: actor.type, actorId: actor.id, from: b.status, to, meta: extra })
  b.status = to
}
