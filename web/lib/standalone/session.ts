/**
 * On-device stand-in for lib/server/session.ts (which reads an httpOnly cookie
 * via next/headers — server-only). In the standalone build there is exactly
 * one user per install, so a UUID persisted in localStorage plays the role of
 * the session cookie: stable across launches, unique per install.
 */
const KEY = 'choicemi-session-id'

let memoryId: string | null = null

export async function getOrCreateSessionId(): Promise<{ id: string; isNew: boolean }> {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return { id: existing, isNew: false }
    const id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
    return { id, isNew: true }
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID()
    return { id: memoryId, isNew: false }
  }
}
