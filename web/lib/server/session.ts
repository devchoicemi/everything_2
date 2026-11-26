import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

const COOKIE = 'cm_session'

/**
 * Anonymous, per-browser session id. This pilot has no real account system
 * yet, but every gate that must survive a refresh (verification attempts, AI
 * rate limiting) needs a stable server-side identity — a signed/httpOnly
 * cookie is the smallest thing that actually does that, and it's a drop-in
 * replacement point once real auth exists (swap this for the authenticated
 * user id).
 */
export async function getOrCreateSessionId(): Promise<{ id: string; isNew: boolean }> {
  const store = await cookies()
  const existing = store.get(COOKIE)?.value
  if (existing) return { id: existing, isNew: false }
  const id = randomUUID()
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return { id, isNew: true }
}
