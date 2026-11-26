import { compactDecrypt, createRemoteJWKSet, importJWK, jwtVerify, type JWK, type JWTPayload } from 'jose'
import { getDb } from '../db'
import { appBaseUrl, signicatConfigured, signicatMock } from './config'
import { pkceChallenge, randomToken } from './crypto'
import { ApiError, safeReturnTo } from './http'
import { logEvent } from './events'
import { encryptField, vaultConfigured } from './vault'

/**
 * Signicat identity verification (OpenID Connect, Authorization Code + PKCE).
 *
 * Nothing in this file holds credentials. Everything comes from the environment:
 *   SIGNICAT_DOMAIN            e.g. choicemi.app.signicat.com
 *   SIGNICAT_CLIENT_ID
 *   SIGNICAT_CLIENT_SECRET
 *   SIGNICAT_ENC_PRIVATE_JWK   private RSA JWK (JSON) that matches the public key uploaded
 *                              to Signicat for ID-token encryption. Optional only if the
 *                              client is NOT set to encrypt ID tokens.
 * Optional:
 *   SIGNICAT_BASE_URL          override https://<domain> (tests)
 *   SIGNICAT_SCOPES            default "openid profile"
 *   SIGNICAT_ACR_VALUES        default "idp:ftn" (Finnish Trust Network)
 *   SIGNICAT_REDIRECT_URI      default <APP_BASE_URL>/api/v1/auth/signicat/callback
 *
 * Privacy: we keep `sub`, `idp`, an over-18 flag derived from `birthdate`, and the
 * verified legal name, encrypted at rest (see vault.ts) for security investigations.
 * The national identity number and date of birth are never stored or logged, and the
 * name is never returned by a member-facing API.
 */

const FLOW_TTL_MIN = 10

interface Discovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

export interface IdentityClaims {
  subject: string
  idp: string | null
  over18: boolean
  /** Verified legal name, if the provider returned one. */
  name: string | null
}

function settings() {
  const domain = process.env.SIGNICAT_DOMAIN!.trim()
  const base = (process.env.SIGNICAT_BASE_URL?.trim() || `https://${domain}`).replace(/\/+$/, '')
  return {
    base,
    discoveryUrl: `${base}/auth/open/.well-known/openid-configuration`,
    clientId: process.env.SIGNICAT_CLIENT_ID!.trim(),
    clientSecret: process.env.SIGNICAT_CLIENT_SECRET!.trim(),
    scopes: process.env.SIGNICAT_SCOPES?.trim() || 'openid profile',
    acr: process.env.SIGNICAT_ACR_VALUES?.trim() || 'idp:ftn',
    redirectUri: process.env.SIGNICAT_REDIRECT_URI?.trim() || `${appBaseUrl()}/api/v1/auth/signicat/callback`,
    encJwk: process.env.SIGNICAT_ENC_PRIVATE_JWK?.trim(),
  }
}

let discoveryCache: { key: string; at: number; doc: Discovery } | undefined
async function discover(): Promise<Discovery> {
  const s = settings()
  if (discoveryCache && discoveryCache.key === s.discoveryUrl && Date.now() - discoveryCache.at < 3_600_000) {
    return discoveryCache.doc
  }
  const res = await fetch(s.discoveryUrl, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Signicat discovery failed: ${res.status}`)
  const doc = (await res.json()) as Discovery
  discoveryCache = { key: s.discoveryUrl, at: Date.now(), doc }
  return doc
}

/** Used by tests, and by anything that rotates configuration at runtime. */
export function resetSignicatCache() {
  discoveryCache = undefined
}

/* ---------------------------------- start --------------------------------- */

/** Creates a pending flow for this user and returns where to send the browser. */
export async function startVerification(userId: string, returnToRaw?: string | null): Promise<{ authorizeUrl: string }> {
  const returnTo = safeReturnTo(returnToRaw, '/onboarding?step=1')
  const mock = signicatMock()
  if (!mock && !signicatConfigured()) {
    throw new ApiError(503, 'signicat_not_configured', 'Identity verification is not switched on yet.')
  }
  if (!mock && !appBaseUrl() && !process.env.SIGNICAT_REDIRECT_URI) {
    throw new ApiError(503, 'app_url_not_set', 'APP_BASE_URL is not configured.')
  }

  const state = randomToken(24)
  const nonce = randomToken(24)
  const verifier = randomToken(48)
  const db = await getDb()
  await db.query('delete from oidc_flows where expires_at < now()')
  await db.query(
    `insert into oidc_flows (state, user_id, nonce, code_verifier, return_to, expires_at)
     values ($1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval)`,
    [state, userId, nonce, verifier, returnTo, String(FLOW_TTL_MIN)],
  )

  if (mock) {
    return { authorizeUrl: `/api/v1/auth/signicat/mock-authorize?state=${encodeURIComponent(state)}` }
  }

  const s = settings()
  const d = await discover()
  const url = new URL(d.authorization_endpoint)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: s.clientId,
    redirect_uri: s.redirectUri,
    scope: s.scopes,
    state,
    nonce,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
    acr_values: s.acr,
    prompt: 'login',
  }).toString()
  return { authorizeUrl: url.toString() }
}

/* -------------------------------- callback -------------------------------- */

export type CallbackResult = { ok: true; returnTo: string } | { ok: false; reason: string; returnTo: string }

/**
 * Finishes a verification: validates `state`, swaps the code for tokens,
 * decrypts + verifies the ID token, and records the verified identity.
 * Never throws for user-facing failures; returns a reason the result page can show.
 */
export async function completeVerification(
  req: Request,
  params: { code?: string | null; state?: string | null; error?: string | null },
  sessionUserId: string,
): Promise<CallbackResult> {
  const db = await getDb()
  const fallback = '/verify/result'
  if (!params.state) return { ok: false, reason: 'invalid_state', returnTo: fallback }

  // Single use: consuming the flow row is what makes a replayed callback fail.
  const { rows } = await db.query<{ user_id: string; nonce: string; code_verifier: string; return_to: string }>(
    `update oidc_flows set consumed_at = now()
      where state = $1 and consumed_at is null and expires_at > now()
      returning user_id, nonce, code_verifier, return_to`,
    [params.state],
  )
  const flow = rows[0]
  if (!flow) return { ok: false, reason: 'expired', returnTo: fallback }
  if (flow.user_id !== sessionUserId) {
    await logEvent(db, 'identity_flow_user_mismatch', req, sessionUserId)
    return { ok: false, reason: 'invalid_state', returnTo: fallback }
  }

  if (params.error) {
    await logEvent(db, 'identity_cancelled', req, sessionUserId, { error: params.error.slice(0, 60) })
    return { ok: false, reason: params.error === 'access_denied' ? 'cancelled' : 'provider_error', returnTo: flow.return_to }
  }
  if (!params.code) return { ok: false, reason: 'invalid_state', returnTo: flow.return_to }

  let claims: IdentityClaims
  try {
    claims = signicatMock() ? mockClaims(sessionUserId) : await exchangeAndVerify(params.code, flow.code_verifier, flow.nonce)
  } catch (e) {
    console.error('[signicat] verification failed:', (e as Error).message)
    await logEvent(db, 'identity_failed', req, sessionUserId)
    return { ok: false, reason: 'verification_failed', returnTo: flow.return_to }
  }

  if (!claims.over18) {
    await logEvent(db, 'identity_underage', req, sessionUserId)
    return { ok: false, reason: 'underage', returnTo: flow.return_to }
  }

  const provider = signicatMock() ? 'mock' : 'signicat'
  let nameEnc: string | null = null
  if (claims.name) {
    if (vaultConfigured()) nameEnc = encryptField(claims.name)
    else console.warn('[signicat] a name was returned but IDENTITY_DATA_KEY is not set, so it was not stored')
  }
  try {
    await db.tx(async (q) => {
      await q.query(
        `insert into identities (user_id, provider, subject, idp, over18, name_enc, verified_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (user_id, provider) do update
           set subject = excluded.subject, idp = excluded.idp, over18 = excluded.over18,
               name_enc = coalesce(excluded.name_enc, identities.name_enc), verified_at = now()`,
        [sessionUserId, provider, claims.subject, claims.idp, claims.over18, nameEnc],
      )
      await q.query('update users set identity_verified_at = now(), updated_at = now() where id = $1', [sessionUserId])
      await logEvent(q, 'identity_verified', req, sessionUserId, { idp: claims.idp })
    })
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      // The same person tried to attach one identity to a second account.
      await logEvent(db, 'identity_duplicate', req, sessionUserId)
      return { ok: false, reason: 'already_linked', returnTo: flow.return_to }
    }
    throw e
  }
  return { ok: true, returnTo: flow.return_to }
}

function mockClaims(userId: string): IdentityClaims {
  return { subject: `mock-${userId}`, idp: 'mock', over18: true, name: 'Mock Person' }
}

/* ------------------------------ token handling ----------------------------- */

async function exchangeAndVerify(code: string, verifier: string, nonce: string): Promise<IdentityClaims> {
  const s = settings()
  const d = await discover()

  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(s.clientId)}:${encodeURIComponent(s.clientSecret)}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: s.redirectUri,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`token endpoint returned ${res.status}`)
  const tokens = (await res.json()) as { id_token?: string }
  if (!tokens.id_token) throw new Error('no id_token in response')

  const payload = await verifyIdToken(tokens.id_token, d, s.clientId, nonce, s.encJwk)
  return claimsFrom(payload)
}

/**
 * Decrypts (if encrypted) and verifies an ID token: signature against the
 * provider's JWKS, issuer, audience, expiry and nonce.
 */
export async function verifyIdToken(
  idToken: string,
  d: Pick<Discovery, 'issuer' | 'jwks_uri'>,
  clientId: string,
  nonce: string,
  encPrivateJwk?: string,
): Promise<JWTPayload> {
  let jws = idToken
  if (idToken.split('.').length === 5) {
    if (!encPrivateJwk) throw new Error('ID token is encrypted but SIGNICAT_ENC_PRIVATE_JWK is not set')
    const key = await importJWK(JSON.parse(encPrivateJwk) as JWK, 'RSA-OAEP')
    const { plaintext } = await compactDecrypt(idToken, key, {
      keyManagementAlgorithms: ['RSA-OAEP', 'RSA-OAEP-256'],
      contentEncryptionAlgorithms: ['A128CBC-HS256', 'A192CBC-HS384', 'A256CBC-HS512', 'A128GCM', 'A256GCM'],
    })
    jws = new TextDecoder().decode(plaintext)
  }
  const { payload } = await jwtVerify(jws, createRemoteJWKSet(new URL(d.jwks_uri)), {
    issuer: d.issuer,
    audience: clientId,
    algorithms: ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384'],
    clockTolerance: 30,
  })
  if (payload.nonce !== nonce) throw new Error('nonce mismatch')
  return payload
}

export function claimsFrom(payload: JWTPayload): IdentityClaims {
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('ID token has no subject')
  return {
    subject: payload.sub,
    idp: typeof payload.idp === 'string' ? payload.idp : null,
    over18: isOver18(payload.birthdate),
    name: nameFrom(payload),
  }
}

function nameFrom(p: JWTPayload): string | null {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const full = str(p.name) || [str(p.given_name), str(p.family_name)].filter(Boolean).join(' ')
  return full ? full.slice(0, 200) : null
}

/** `birthdate` is YYYY-MM-DD (OIDC core). A missing or malformed value is treated as "not verified adult". */
export function isOver18(birthdate: unknown, now = new Date()): boolean {
  if (typeof birthdate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return false
  const [y, m, d] = birthdate.split('-').map(Number)
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
  return new Date(Date.UTC(y, m - 1, d)) <= cutoff
}
