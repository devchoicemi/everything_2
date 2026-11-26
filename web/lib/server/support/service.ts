import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import { appBaseUrl, partnerBaseUrl } from '../auth/config'
import { noticeMail, sendMail } from '../auth/mailer'
import { rateLimit } from '../auth/rateLimit'
import type { PublicUser } from '../auth/service'
import { notifyDater } from '../booking/notify'
import { audit, type StaffContext } from '../staff/access'

/**
 * The helpdesk. Members and venues write in from their own app; staff answer from the staff site. Every ticket
 * has a reference (HD-10001), a priority, an owner, and a first-response deadline so slow answers show up.
 */
export const CATEGORIES = ['account', 'booking', 'safety', 'venue', 'bug', 'other'] as const
export type Category = (typeof CATEGORIES)[number]
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]
export const STATUSES = ['open', 'waiting_customer', 'resolved', 'closed'] as const
export type TicketStatus = (typeof STATUSES)[number]

/** Hours until the first answer is due. */
export const FIRST_RESPONSE_HOURS: Record<Priority, number> = { urgent: 1, high: 4, normal: 24, low: 72 }

const UUID = /^[0-9a-f-]{36}$/i
const BODY_MAX = 4000

const text = (v: unknown, min: number, max: number, label: string, field: string): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min || s.length > max) throw new ApiError(400, 'invalid_request', `${label} must be ${min} to ${max} characters.`, { [field]: 'Check this.' })
  return s
}

async function newRef(q: Queryable): Promise<string> {
  const n = (await q.query<{ n: string }>(`select nextval('support_ticket_seq')::text as n`)).rows[0].n
  return `HD-${n}`
}

async function addEvent(q: Queryable, ticketId: string, actorId: string | null, event: string, meta?: Record<string, unknown>) {
  await q.query('insert into support_events (ticket_id, actor_id, event, meta) values ($1, $2, $3, $4::jsonb)', [ticketId, actorId, event, meta ? JSON.stringify(meta) : null])
}

/** Used by the app, and by the system when a dater reports a concern. */
export async function openTicket(
  q: Queryable,
  p: { requesterId: string | null; kind: 'member' | 'partner'; venueId?: string | null; bookingId?: string | null; category: Category; priority?: Priority; subject: string; body: string; source: 'app' | 'portal' | 'report' | 'system' },
): Promise<{ id: string; ref: string }> {
  const priority = p.priority ?? (p.category === 'safety' ? 'urgent' : p.category === 'booking' ? 'high' : 'normal')
  const ref = await newRef(q)
  const row = (
    await q.query<{ id: string }>(
      `insert into support_tickets (ref, requester_id, requester_kind, venue_id, booking_id, category, subject, priority, source, first_response_due_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + ($10 || ' hours')::interval) returning id`,
      [ref, p.requesterId, p.kind, p.venueId ?? null, p.bookingId ?? null, p.category, p.subject, priority, p.source, String(FIRST_RESPONSE_HOURS[priority])],
    )
  ).rows[0]
  await q.query(`insert into support_messages (ticket_id, author_id, author_kind, body) values ($1, $2, $3, $4)`, [row.id, p.requesterId, p.source === 'system' || p.source === 'report' ? 'system' : 'requester', p.body])
  await addEvent(q, row.id, p.requesterId, 'opened', { priority, source: p.source })
  return { id: row.id, ref }
}

/* ------------------------------------------------------------ the requester */

export async function createTicket(user: PublicUser, body: Record<string, unknown>) {
  await rateLimit('support-open', user.id, 10, 3600)
  const category = body.category
  if (typeof category !== 'string' || !(CATEGORIES as readonly string[]).includes(category)) throw new ApiError(400, 'invalid_request', 'Choose what this is about.', { category: 'Check this.' })
  const subject = text(body.subject, 3, 120, 'The subject', 'subject')
  const message = text(body.body, 5, BODY_MAX, 'The message', 'body')
  const db = await getDb()
  return db.tx(async (q) => {
    let bookingId: string | null = null
    if (typeof body.bookingRef === 'string' && body.bookingRef.trim()) {
      const b = (await q.query<{ id: string }>('select id from bookings where ref = $1 and (user_a = $2 or user_b = $2)', [body.bookingRef.trim().toUpperCase(), user.id])).rows[0]
      bookingId = b?.id ?? null
    }
    const isPartner = user.role === 'partner'
    const venueId = isPartner ? ((await q.query<{ venue_id: string }>('select venue_id from venue_staff where user_id = $1 order by created_at limit 1', [user.id])).rows[0]?.venue_id ?? null) : null
    const t = await openTicket(q, { requesterId: user.id, kind: isPartner ? 'partner' : 'member', venueId, bookingId, category: category as Category, subject, body: message, source: isPartner ? 'portal' : 'app' })
    return { id: t.id, ref: t.ref }
  })
}

export async function myTickets(user: PublicUser) {
  const db = await getDb()
  const { rows } = await db.query(
    `select id, ref, subject, category, status, last_activity_at, created_at,
            (select count(*)::int from support_messages m where m.ticket_id = t.id and m.author_kind = 'staff' and not m.internal and m.created_at > coalesce((select max(created_at) from support_messages r where r.ticket_id = t.id and r.author_kind = 'requester'), t.created_at)) as unseen_replies
       from support_tickets t where requester_id = $1 order by last_activity_at desc limit 100`,
    [user.id],
  )
  return { tickets: rows }
}

async function ownTicket(q: Queryable, user: PublicUser, id: string, lock = false) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such ticket.')
  const t = (await q.query<{ id: string; ref: string; status: TicketStatus; subject: string; category: string }>(`select id, ref, status, subject, category from support_tickets where id = $1 and requester_id = $2 ${lock ? 'for update' : ''}`, [id, user.id])).rows[0]
  if (!t) throw new ApiError(404, 'not_found', 'No such ticket.')
  return t
}

export async function myTicket(user: PublicUser, id: string) {
  const db = await getDb()
  const t = await ownTicket(db, user, id)
  const messages = (await db.query(`select id, author_kind, body, created_at from support_messages where ticket_id = $1 and not internal order by created_at`, [id])).rows
  return { ticket: t, messages }
}

export async function replyAsRequester(user: PublicUser, id: string, body: Record<string, unknown>) {
  await rateLimit('support-reply', user.id, 30, 3600)
  const message = text(body.body, 1, BODY_MAX, 'The message', 'body')
  const db = await getDb()
  await db.tx(async (q) => {
    const t = await ownTicket(q, user, id, true)
    if (t.status === 'closed') throw new ApiError(409, 'closed', 'This ticket is closed. Open a new one if you still need help.')
    await q.query(`insert into support_messages (ticket_id, author_id, author_kind, body) values ($1, $2, 'requester', $3)`, [id, user.id, message])
    // an answer reopens a ticket that was waiting for them or had been marked solved
    await q.query(`update support_tickets set status = 'open', resolved_at = null, last_activity_at = now() where id = $1`, [id])
    await addEvent(q, id, user.id, 'requester_replied')
  })
  return { ok: true as const }
}

/* -------------------------------------------------------------------- staff */

export interface TicketFilters {
  status?: string | null
  assignee?: string | null
  priority?: string | null
  q?: string | null
  breached?: boolean
}

export async function listTickets(ctx: StaffContext, url: URL) {
  const f: TicketFilters = {
    status: url.searchParams.get('status'),
    assignee: url.searchParams.get('assignee'),
    priority: url.searchParams.get('priority'),
    q: url.searchParams.get('q')?.trim().toLowerCase().slice(0, 60) || null,
    breached: url.searchParams.get('breached') === '1',
  }
  if (f.status && f.status !== 'active' && !(STATUSES as readonly string[]).includes(f.status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')
  if (f.priority && !(PRIORITIES as readonly string[]).includes(f.priority)) throw new ApiError(400, 'invalid_request', 'Unknown priority.')
  const db = await getDb()
  const params: unknown[] = []
  const where: string[] = []
  const add = (sql: string, v: unknown) => {
    params.push(v)
    where.push(sql.replace(/\?/g, `$${params.length}`))
  }
  if (f.status === 'active') where.push(`t.status in ('open', 'waiting_customer')`)
  else if (f.status) add('t.status = ?', f.status)
  if (f.priority) add('t.priority = ?', f.priority)
  if (f.assignee === 'me' && ctx.userId) add('t.assignee_id = ?', ctx.userId)
  else if (f.assignee === 'unassigned') where.push('t.assignee_id is null')
  else if (f.assignee && UUID.test(f.assignee)) add('t.assignee_id = ?', f.assignee)
  if (f.q) add(`(lower(t.ref) like ? or lower(t.subject) like ? or lower(coalesce(u.username, '')) like ? or lower(coalesce(u.email, '')) like ?)`, `%${f.q}%`)
  if (f.breached) where.push(`t.first_response_at is null and t.first_response_due_at < now() and t.status = 'open'`)
  const sql = where.length ? `where ${where.join(' and ')}` : ''
  const { rows } = await db.query(
    `select t.id, t.ref, t.subject, t.category, t.status, t.priority, t.source, t.requester_kind, t.created_at, t.last_activity_at, t.first_response_due_at, t.first_response_at,
            (t.first_response_at is null and t.first_response_due_at < now() and t.status = 'open') as breached,
            u.username as requester, a.username as assignee, t.assignee_id
       from support_tickets t left join users u on u.id = t.requester_id left join users a on a.id = t.assignee_id
       ${sql} order by (t.status in ('resolved', 'closed')), case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.created_at limit 200`,
    params,
  )
  const counts = (
    await db.query<{ open: number; waiting: number; breached: number; unassigned: number; mine: number; resolved_today: number; avg_first_minutes: number | null }>(
      `select count(*) filter (where status = 'open')::int as open,
              count(*) filter (where status = 'waiting_customer')::int as waiting,
              count(*) filter (where first_response_at is null and first_response_due_at < now() and status = 'open')::int as breached,
              count(*) filter (where assignee_id is null and status = 'open')::int as unassigned,
              count(*) filter (where assignee_id = $1::uuid and status in ('open', 'waiting_customer'))::int as mine,
              count(*) filter (where resolved_at > now() - interval '1 day')::int as resolved_today,
              (avg(extract(epoch from (first_response_at - created_at)) / 60) filter (where first_response_at > now() - interval '30 days'))::int as avg_first_minutes
         from support_tickets`,
      [ctx.userId],
    )
  ).rows[0]
  return { counts, tickets: rows }
}

export async function ticketDetail(ctx: StaffContext, id: string) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such ticket.')
  const db = await getDb()
  const t = (
    await db.query(
      `select t.id, t.ref, t.subject, t.category, t.status, t.priority, t.source, t.requester_kind, t.created_at, t.last_activity_at, t.first_response_due_at, t.first_response_at, t.resolved_at, t.assignee_id,
              (t.first_response_at is null and t.first_response_due_at < now() and t.status = 'open') as breached,
              u.id as requester_id, u.username as requester, u.email as requester_email, a.username as assignee, b.ref as booking_ref, b.id as booking_id, v.name as venue
         from support_tickets t left join users u on u.id = t.requester_id left join users a on a.id = t.assignee_id
         left join bookings b on b.id = t.booking_id left join venues v on v.id = t.venue_id where t.id = $1`,
      [id],
    )
  ).rows[0]
  if (!t) throw new ApiError(404, 'not_found', 'No such ticket.')
  const messages = (await db.query(`select m.id, m.author_kind, m.internal, m.body, m.created_at, u.username as author from support_messages m left join users u on u.id = m.author_id where m.ticket_id = $1 order by m.created_at`, [id])).rows
  const events = (await db.query(`select e.at, e.event, e.meta, u.username as actor from support_events e left join users u on u.id = e.actor_id where e.ticket_id = $1 order by e.at, e.id`, [id])).rows
  return { ticket: t, messages, events, statuses: STATUSES, priorities: PRIORITIES }
}

export async function staffReply(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such ticket.')
  const message = text(body.body, 1, BODY_MAX, 'The message', 'body')
  const internal = body.internal === true
  const db = await getDb()
  let notify: { email: string; ref: string; subject: string; kind: string } | null = null
  await db.tx(async (q) => {
    const t = (await q.query<{ status: TicketStatus; requester_id: string | null; ref: string; subject: string; requester_kind: string; first_response_at: Date | null }>(`select status, requester_id, ref, subject, requester_kind, first_response_at from support_tickets where id = $1 for update`, [id])).rows[0]
    if (!t) throw new ApiError(404, 'not_found', 'No such ticket.')
    await q.query(`insert into support_messages (ticket_id, author_id, author_kind, internal, body) values ($1, $2, 'staff', $3, $4)`, [id, ctx.userId, internal, message])
    if (internal) {
      await q.query('update support_tickets set last_activity_at = now() where id = $1', [id])
      await addEvent(q, id, ctx.userId, 'internal_note')
      return
    }
    const status = body.status === 'resolved' || body.status === 'open' || body.status === 'waiting_customer' ? (body.status as TicketStatus) : 'waiting_customer'
    await q.query(
      `update support_tickets set status = $2, first_response_at = coalesce(first_response_at, now()), resolved_at = case when $2 = 'resolved' then now() else null end,
              assignee_id = coalesce(assignee_id, $3::uuid), last_activity_at = now() where id = $1`,
      [id, status, ctx.userId],
    )
    await addEvent(q, id, ctx.userId, 'replied', { status })
    await audit(q, ctx, req, 'support.replied', { type: 'ticket', id: t.ref })
    if (t.requester_id) {
      await notifyDater(q, { userId: t.requester_id, bookingId: null, no: 0, code: 'support_reply', title: `ChoiceMi support replied (${t.ref})`, body: message.slice(0, 200) })
      const email = (await q.query<{ email: string }>('select email from users where id = $1', [t.requester_id])).rows[0]?.email
      if (email) notify = { email, ref: t.ref, subject: t.subject, kind: t.requester_kind }
    }
  })
  if (notify) {
    const n = notify as { email: string; ref: string; subject: string; kind: string }
    const where = n.kind === 'partner' ? partnerBaseUrl() : appBaseUrl() || 'https://choicemi.com'
    await sendMail(noticeMail(n.email, `ChoiceMi support: ${n.ref}`, [`We replied to your request "${n.subject}".`, message], { label: 'Open your request', url: `${where}/help` }, 'Reply from the app or portal. Replying to this email does not reach us.')).catch(() => {})
  }
  return { ok: true as const }
}

/** Assign (to someone, to yourself with "me", or to nobody with null), and change status or priority. */
export async function updateTicket(ctx: StaffContext, req: Request, id: string, body: Record<string, unknown>) {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', 'No such ticket.')
  const db = await getDb()
  await db.tx(async (q) => {
    const t = (await q.query<{ ref: string; status: TicketStatus; priority: Priority }>('select ref, status, priority from support_tickets where id = $1 for update', [id])).rows[0]
    if (!t) throw new ApiError(404, 'not_found', 'No such ticket.')
    if ('assignee' in body) {
      let assignee: string | null = null
      if (body.assignee === 'me') {
        if (!ctx.userId) throw new ApiError(400, 'invalid_request', 'Choose a person.')
        assignee = ctx.userId
      } else if (typeof body.assignee === 'string' && UUID.test(body.assignee)) {
        if (!(await q.query('select 1 from staff where user_id = $1 and active', [body.assignee])).rows.length) throw new ApiError(400, 'invalid_request', 'That person is not on the team.')
        assignee = body.assignee
      } else if (body.assignee !== null) throw new ApiError(400, 'invalid_request', 'Choose a person, "me" or nobody.')
      await q.query('update support_tickets set assignee_id = $2, last_activity_at = now() where id = $1', [id, assignee])
      await addEvent(q, id, ctx.userId, 'assigned', { to: assignee })
    }
    if ('status' in body) {
      if (typeof body.status !== 'string' || !(STATUSES as readonly string[]).includes(body.status)) throw new ApiError(400, 'invalid_request', 'Unknown status.')
      await q.query(`update support_tickets set status = $2, resolved_at = case when $2 in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end, last_activity_at = now() where id = $1`, [id, body.status])
      await addEvent(q, id, ctx.userId, 'status', { from: t.status, to: body.status })
    }
    if ('priority' in body) {
      if (typeof body.priority !== 'string' || !(PRIORITIES as readonly string[]).includes(body.priority)) throw new ApiError(400, 'invalid_request', 'Unknown priority.')
      await q.query('update support_tickets set priority = $2, last_activity_at = now() where id = $1', [id, body.priority])
      await addEvent(q, id, ctx.userId, 'priority', { from: t.priority, to: body.priority })
    }
    await audit(q, ctx, req, 'support.updated', { type: 'ticket', id: t.ref }, body)
  })
  return { ok: true as const }
}
