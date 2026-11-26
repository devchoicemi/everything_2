import { getDb, type Queryable } from '../db'
import { ApiError } from '../auth/http'
import { INVITE_TTL_DAYS } from '../auth/config'
import { logEvent } from '../auth/events'
import { partnerInviteMail, sendMail } from '../auth/mailer'
import { normalizeEmail } from '../auth/validate'
import { createInvite } from '../auth/waitlist'

/**
 * Setting up a venue ChoiceMi has already agreed with: it creates the venue (not yet bookable) and emails the owner
 * a one-time link to create their sign-in. Everyone else starts their own application on restaurant.choicemi.com.
 */
const text = (v: unknown, max: number, field: string, required = false): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if ((required && !s) || s.length > max) throw new ApiError(400, 'invalid_request', required ? `Please fill in ${field}.` : `${field} is too long.`, { [field]: 'Check this.' })
  return s
}

function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'venue'
}

async function uniqueVenueId(q: Queryable, name: string): Promise<string> {
  const base = slugify(name)
  for (let i = 1; i < 50; i++) {
    const id = i === 1 ? base : `${base}-${i}`
    if (!(await q.query('select 1 from venues where id = $1', [id])).rows.length) return id
  }
  throw new ApiError(500, 'internal', 'Could not name the venue.')
}

interface NewVenue {
  venueName: string
  email: string
  area?: string
  address?: string
  city?: string
  phone?: string
}

/** Makes a venue (not bookable until its owner goes live) and emails its owner the link to create their sign-in. */
async function createVenueAndInvite(req: Request, v: NewVenue): Promise<{ venueId: string; email: string }> {
  const db = await getDb()
  const taken = await db.query('select 1 from users where email = $1', [v.email])
  if (taken.rows.length) throw new ApiError(409, 'email_taken', 'That email already has a ChoiceMi account.')
  const { venueId, token } = await db.tx(async (q) => {
    const venueId = await uniqueVenueId(q, v.venueName)
    await q.query(
      `insert into venues (id, name, area, kind, offer, address, city, phone, status, sort_order)
       values ($1, $2, $3, '', '', $4, $5, $6, 'pending', (select coalesce(max(sort_order), 0) + 1 from venues))`,
      [venueId, v.venueName, v.area ?? '', v.address ?? '', v.city || 'Helsinki', v.phone ?? ''],
    )
    const token = await createInvite(q, v.email, { role: 'partner', venueId })
    await logEvent(q, 'partner_approved', req, null, { venue: venueId })
    return { venueId, token }
  })
  const sent = await sendMail(partnerInviteMail(v.email, token, v.venueName, INVITE_TTL_DAYS))
  if (!sent) throw new ApiError(503, 'mail_failed', 'The venue was created but the invitation could not be emailed. Run approve again to resend.')
  return { venueId, email: v.email }
}

/** Sets up a venue directly (someone you already agreed with), without a form request. */
export async function createPartner(req: Request, body: Record<string, unknown>) {
  return createVenueAndInvite(req, {
    venueName: text(body.venueName, 100, 'venueName', true),
    email: normalizeEmail(body.email),
    area: text(body.area, 60, 'area'),
    address: text(body.address, 160, 'address'),
    city: text(body.city, 60, 'city'),
    phone: text(body.phone, 40, 'phone'),
  })
}
