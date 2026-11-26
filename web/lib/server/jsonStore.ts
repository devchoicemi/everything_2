import fs from 'node:fs'
import path from 'node:path'

/**
 * Minimal file-backed JSON store for the pilot backend.
 *
 * This is a deliberate, documented placeholder for a real database
 * (Postgres/Supabase — see web/README.md "Connecting a real backend").
 * It gives every API route genuine server-side persistence (state survives a
 * page refresh, a new browser tab, and a dev-server restart) without pulling
 * in infra credentials this environment doesn't have.
 *
 * `mutateTable` chains every write to the same table through one promise,
 * which serialises concurrent mutations — the async-mutex the verification
 * attempt-store relies on to stay correct under concurrent requests.
 */

const DATA_DIR = path.join(process.cwd(), '.data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`)
}

const memCache = new Map<string, unknown>()
const queues = new Map<string, Promise<unknown>>()

// Tests run entirely in-memory — no disk I/O, and __resetStoreForTests gives
// full isolation between test files/cases without touching the real .data/.
const TEST_MODE = process.env.NODE_ENV === 'test' || !!process.env.VITEST

export function readTable<T>(name: string, fallback: T): T {
  if (memCache.has(name)) return memCache.get(name) as T
  if (TEST_MODE) {
    memCache.set(name, fallback)
    return fallback
  }
  ensureDir()
  const fp = filePath(name)
  if (!fs.existsSync(fp)) {
    memCache.set(name, fallback)
    return fallback
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8')) as T
    memCache.set(name, parsed)
    return parsed
  } catch {
    memCache.set(name, fallback)
    return fallback
  }
}

function writeTable(name: string, data: unknown) {
  memCache.set(name, data)
  if (TEST_MODE) return
  ensureDir()
  const fp = filePath(name)
  const tmp = `${fp}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, fp)
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

/** Test-only: reset the in-memory cache and pending write queue between tests. */
export function __resetStoreForTests() {
  memCache.clear()
  queues.clear()
}
