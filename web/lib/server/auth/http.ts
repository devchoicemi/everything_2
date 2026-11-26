import { COOKIE_NAME, SESSION_DAYS, appBaseUrl, cookieSecure } from './config'

/** An error that is safe to show to the caller. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export function json(body: unknown, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store')
  for (const c of init.cookies ?? []) headers.append('Set-Cookie', c)
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

/** Wraps a route so thrown ApiErrors become clean JSON and anything else becomes a logged 500. */
export function route(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') assertSameOrigin(req)
      return await fn(req)
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status })
      }
      console.error('[auth] unhandled error', e)
      return json({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } }, { status: 500 })
    }
  }
}

/**
 * CSRF defence for cookie auth, on top of SameSite=Lax: a browser always sends
 * Origin on cross-site POSTs, so any Origin that is not ours is refused.
 * Non-browser clients send no Origin and carry no ambient cookies, so they pass.
 */
export function assertSameOrigin(req: Request): void {
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'bad_origin', 'Request blocked.')
  const origin = req.headers.get('origin')
  if (!origin) return
  const allowed = new Set<string>([new URL(req.url).origin])
  const base = appBaseUrl()
  if (base) allowed.add(new URL(base).origin)
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')
    allowed.add(`${proto}://${host}`)
  }
  if (!allowed.has(origin)) throw new ApiError(403, 'bad_origin', 'Request blocked.')
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const type = req.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) throw new ApiError(415, 'bad_content_type', 'Send JSON.')
  const text = await req.text()
  if (text.length > 16_384) throw new ApiError(413, 'too_large', 'Request too large.')
  try {
    const body = JSON.parse(text)
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object')
    return body as T
  } catch {
    throw new ApiError(400, 'bad_json', 'Invalid request body.')
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || req.headers.get('x-real-ip') || 'unknown'
}

export function userAgent(req: Request): string {
  return (req.headers.get('user-agent') ?? '').slice(0, 300)
}

/* -------------------------------- cookies ------------------------------- */

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

export function sessionCookie(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 86400}`,
  ]
  if (cookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(): string {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (cookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

/** Only same-site relative paths may be used as a post-login destination. */
export function safeReturnTo(value: string | null | undefined, fallback = '/onboarding?step=1'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  return value
}
