/**
 * Standalone (offline Android) build only: an in-app stand-in for the Next.js
 * server. services/api.ts calls this instead of fetch('/api/...'), and it
 * dispatches to the *same* route handlers under app/api — imported through the
 * `@api` alias (see next.config.js) — so compatibility scoring, the read-check
 * gate, date rules and draft validation behave exactly as they do on the
 * server. Only the two server-only modules underneath them (cookie session,
 * file store) are swapped for on-device versions at build time.
 */

type Handler = (req: Request, ctx: { params: Record<string, string> }) => Promise<Response> | Response
type RouteModule = Partial<Record<'GET' | 'POST', Handler>>

interface Route {
  pattern: RegExp
  keys: string[]
  load: () => Promise<RouteModule>
}

function route(path: string, load: () => Promise<unknown>): Route {
  const keys: string[] = []
  const source = path.replace(/:(\w+)/g, (_m, key: string) => {
    keys.push(key)
    return '([^/]+)'
  })
  return { pattern: new RegExp(`^${source}/?$`), keys, load: load as () => Promise<RouteModule> }
}

const ROUTES: Route[] = [
  route('/profile/variables', () => import('@api/profile/variables/route')),
  route('/profile/gate-questions', () => import('@api/profile/gate-questions/route')),
  route('/compatibility/:userAId/:userBId', () => import('@api/compatibility/[userAId]/[userBId]/route')),
  route('/ai/profile-draft', () => import('@api/ai/profile-draft/route')),
  route('/dates/propose', () => import('@api/dates/propose/route')),
  route('/verification/:targetId/start', () => import('@api/verification/[targetId]/start/route')),
  route('/verification/:targetId/answer', () => import('@api/verification/[targetId]/answer/route')),
  route('/verification/:targetId/status', () => import('@api/verification/[targetId]/status/route')),
]

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Drop-in for fetch(`/api${path}`, init) — `path` excludes the /api prefix. */
export async function standaloneFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const pathname = path.split('?')[0]
  const method = (init.method ?? 'GET').toUpperCase() as 'GET' | 'POST'

  for (const r of ROUTES) {
    const m = r.pattern.exec(pathname)
    if (!m) continue

    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(m[i + 1])
    })

    const mod = await r.load()
    const handler = mod[method]
    if (!handler) return json(405, { error: 'Method not allowed' })

    try {
      // Absolute URL only because Request requires one; handlers read the body/params, never the host.
      const req = new Request(`https://choicemi.local/api${pathname}`, { ...init, method })
      return await handler(req, { params })
    } catch {
      return json(500, { error: 'Something went wrong on this device — please try again.' })
    }
  }

  return json(404, { error: `No route for ${method} ${pathname}` })
}
