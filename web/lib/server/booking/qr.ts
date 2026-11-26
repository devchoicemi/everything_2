import { randomInt } from 'node:crypto'
import { linkSecret } from '../auth/config'
import { randomToken, safeEqual, signValue } from '../auth/crypto'

/**
 * A dater's check-in QR code. It holds a signed token (booking, dater and a one-time nonce), never a
 * username, so a screenshot of it reveals nothing and it cannot be forged or reused.
 */
export interface QrClaims {
  b: string
  u: string
  n: string
}

const secret = () => `qr:${linkSecret() || 'dev-only-qr-secret'}`

export const newNonce = () => randomToken(16)

export function makeQrToken(claims: QrClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `cm1.${body}.${signValue(secret(), body)}`
}

/** The claims if the token is genuine; null otherwise. */
export function readQrToken(token: unknown): QrClaims | null {
  if (typeof token !== 'string' || token.length > 400) return null
  const [v, body, sig] = token.trim().split('.')
  if (v !== 'cm1' || !body || !sig || !safeEqual(sig, signValue(secret(), body))) return null
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<QrClaims>
    return typeof c.b === 'string' && typeof c.u === 'string' && typeof c.n === 'string' ? (c as QrClaims) : null
  } catch {
    return null
  }
}

/** Four digits the dater can read out when a scan fails. Always used together with the username. */
export const newBookingCode = () => String(randomInt(0, 10_000)).padStart(4, '0')

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newRef = () => `CM-${Array.from({ length: 5 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('')}`
