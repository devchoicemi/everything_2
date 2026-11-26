import type { Queryable } from '../db'
import { clientIp, userAgent } from './http'

/** Appends to the security log (auth_events). */
export async function logEvent(
  q: Queryable,
  type: string,
  req: Request | null,
  userId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await q.query('insert into auth_events (user_id, type, ip, user_agent, meta) values ($1, $2, $3, $4, $5)', [
    userId,
    type,
    req ? clientIp(req) : null,
    req ? userAgent(req) : null,
    meta ? JSON.stringify(meta) : null,
  ])
}
