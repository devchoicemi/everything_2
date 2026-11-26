/**
 * On-device stand-in for lib/server/jsonStore.ts, swapped in at build time for
 * the standalone (offline Android) build — see next.config.js. Same exports and
 * same serialised-write semantics, but backed by localStorage instead of the
 * server's .data/ folder, so the real API route handlers run unmodified inside
 * the app.
 */

const PREFIX = 'choicemi-table:'

const memCache = new Map<string, unknown>()
const queues = new Map<string, Promise<unknown>>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readTable<T>(name: string, fallback: T): T {
  if (memCache.has(name)) return memCache.get(name) as T
  const raw = storage()?.getItem(PREFIX + name)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as T
      memCache.set(name, parsed)
      return parsed
    } catch {
      // corrupted entry — fall through to the fallback rather than crash the app
    }
  }
  memCache.set(name, fallback)
  return fallback
}

function writeTable(name: string, data: unknown) {
  memCache.set(name, data)
  try {
    storage()?.setItem(PREFIX + name, JSON.stringify(data))
  } catch {
    // storage full/blocked — the in-memory copy still serves this session
  }
}

export async function mutateTable<T>(
  name: string,
  fallback: T,
  mutator: (data: T) => T | Promise<T>,
): Promise<T> {
  const prior = (queues.get(name) as Promise<T> | undefined) ?? Promise.resolve(undefined)
  const next = prior
    .catch(() => undefined)
    .then(async () => {
      const current = readTable<T>(name, fallback)
      const updated = await mutator(current)
      writeTable(name, updated)
      return updated
    })
  queues.set(name, next)
  return next
}

export function __resetStoreForTests() {
  memCache.clear()
  queues.clear()
}
