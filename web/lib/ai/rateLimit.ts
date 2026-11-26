/**
 * Minimal sliding-window rate limiter for server-only AI calls. In-memory is
 * fine for a single pilot instance; swap for a shared store (Redis) once
 * this runs on more than one server process.
 */

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 5

const hits = new Map<string, number[]>()

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0]
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    hits.set(key, recent)
    return { allowed: false, retryAfterSeconds }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

export function __resetRateLimitForTests() {
  hits.clear()
}
