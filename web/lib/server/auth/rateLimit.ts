import { getDb } from '../db'
import { ApiError } from './http'

/**
 * Fixed-window counter kept in Postgres, so limits hold across restarts and
 * across several app instances. Throws a 429 once `max` hits are exceeded
 * within `windowSec`.
 */
export async function rateLimit(name: string, id: string, max: number, windowSec: number): Promise<void> {
  const db = await getDb()
  const bucket = Math.floor(Date.now() / 1000 / windowSec)
  const key = `${name}:${id}:${bucket}`
  const { rows } = await db.query<{ count: number }>(
    `insert into rate_limits (key, count, expires_at) values ($1, 1, now() + ($2 || ' seconds')::interval)
     on conflict (key) do update set count = rate_limits.count + 1
     returning count`,
    [key, String(windowSec * 2)],
  )
  if (rows[0].count > max) {
    throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.')
  }
  if (Math.random() < 0.02) void db.query('delete from rate_limits where expires_at < now()').catch(() => undefined)
}
