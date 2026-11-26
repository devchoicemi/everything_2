import type { Queryable } from '../db'
import { appBaseUrl, partnerBaseUrl } from '../auth/config'
import { noticeMail, sendMail, type Mail } from '../auth/mailer'
import { sendSms, type Sms } from '../auth/sms'
import { formatSlotLabel } from '@/lib/booking'

/**
 * The twenty notifications in the spec. Daters get an in-app message ("push": the same text is what a
 * push notification would carry). Venues get an email and an SMS only when they must act, and
 * everything else stays in the portal. ChoiceMi staff see theirs in the dashboard.
 *
 * Rows are written inside the caller's transaction. Emails and SMS are queued in an Outbox and sent only
 * after the transaction commits, so a rolled-back change never sends a message.
 */
export class Outbox {
  mails: Mail[] = []
  texts: Sms[] = []
  async flush(): Promise<void> {
    const mails = this.mails
    const texts = this.texts
    this.mails = []
    this.texts = []
    await Promise.all([...mails.map((m) => sendMail(m).catch(() => false)), ...texts.map((t) => sendSms(t).catch(() => false))])
  }
}

interface Base {
  bookingId: string | null
  no: number
  code: string
  title: string
  body: string
}

export async function notifyDater(q: Queryable, p: Base & { userId: string }): Promise<void> {
  await q.query(
    `insert into notifications (audience, user_id, booking_id, event_no, code, title, body, channels) values ('dater', $1, $2, $3, $4, $5, $6, '{push}')`,
    [p.userId, p.bookingId, p.no, p.code, p.title, p.body],
  )
}

/** A message for the venue's portal, and (when the spec says it must act) its email and SMS. */
export async function notifyVenue(
  q: Queryable,
  out: Outbox,
  p: Base & { venueId: string; email?: boolean; sms?: boolean; cta?: { label: string; path: string }; smsText?: string },
): Promise<void> {
  const channels = ['portal', ...(p.email ? ['email'] : []), ...(p.sms ? ['sms'] : [])]
  await q.query(
    `insert into notifications (audience, venue_id, booking_id, event_no, code, title, body, channels) values ('venue', $1, $2, $3, $4, $5, $6, $7::text[])`,
    [p.venueId, p.bookingId, p.no, p.code, p.title, p.body, channels],
  )
  if (!p.email && !p.sms) return
  const v = (await q.query<{ contact_email: string; contact_email_verified_at: Date | null; booking_phone: string; booking_phone_verified_at: Date | null }>(
    'select contact_email, contact_email_verified_at, booking_phone, booking_phone_verified_at from venues where id = $1',
    [p.venueId],
  )).rows[0]
  if (!v) return
  const url = p.cta ? `${partnerBaseUrl()}${p.cta.path}` : undefined
  if (p.email && v.contact_email && v.contact_email_verified_at) {
    out.mails.push(noticeMail(v.contact_email, p.title, p.body.split('\n\n'), p.cta && url ? { label: p.cta.label, url } : undefined, 'You get this because your venue is a ChoiceMi partner. Answers happen in the portal.'))
  }
  if (p.sms && v.booking_phone && v.booking_phone_verified_at) {
    out.texts.push({ to: v.booking_phone, text: (p.smsText ?? `${p.title}. ${p.body.replace(/\n+/g, ' ')}`).slice(0, 300) + (url ? ` ${url}` : '') })
  }
}

export async function notifyAdmin(q: Queryable, p: Base): Promise<void> {
  await q.query(`insert into notifications (audience, booking_id, event_no, code, title, body, channels) values ('admin', $1, $2, $3, $4, $5, '{admin}')`, [p.bookingId, p.no, p.code, p.title, p.body])
}

/* ------------------------------ wording helpers ------------------------------ */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Sat 7 Nov" from YYYY-MM-DD. */
export function dayText(dateOn: string): string {
  const [y, m, d] = dateOn.split('-').map(Number)
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`
}

export const whenText = (dateOn: string, time: string) => `${dayText(dateOn)} at ${time}`
export { formatSlotLabel }

export const memberLink = (path: string) => `${appBaseUrl() || 'http://localhost:3000'}${path}`
