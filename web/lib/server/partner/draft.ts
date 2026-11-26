import type { Queryable } from '../db'
import { ApiError } from '../auth/http'
import { randomToken } from '../auth/crypto'

/** The empty draft a new applicant works on. Created with their account, so nothing they type is lost. */
export async function createDraftVenue(q: Queryable, userId: string, contactName: string, contactEmail: string): Promise<string> {
  let id = ''
  for (let i = 0; i < 20 && !id; i++) {
    const cand = `v-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`
    if (!(await q.query('select 1 from venues where id = $1', [cand])).rows.length) id = cand
  }
  if (!id) throw new ApiError(500, 'internal', 'Could not start your application.')
  await q.query(
    `insert into venues (id, name, area, kind, offer, status, review_status, contact_name, contact_email, sort_order, hours, open_days, slot_times)
     values ($1, 'My venue', '', '', '', 'pending', 'draft', $2, $3, (select coalesce(max(sort_order), 0) + 1 from venues), '{}'::jsonb, '{}', '{}')`,
    [id, contactName, contactEmail],
  )
  await q.query('insert into venue_staff (user_id, venue_id, role) values ($1, $2, $3)', [userId, id, 'owner'])
  await q.query(`update users set role = 'partner' where id = $1`, [userId])
  return id
}
