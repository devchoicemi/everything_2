import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { AuthError, apiCall, type PasskeyInfo, type SessionState } from '@/services/auth'

/**
 * Passkeys from the browser: a fingerprint, face or screen lock instead of a password and a code.
 * The device keeps the private key; the server only ever gets the public key.
 */
const STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === '1'

/** True where this browser can make and use passkeys (not the offline app, which has no accounts). */
export const passkeysSupported = () => !STANDALONE && typeof window !== 'undefined' && browserSupportsWebAuthn()

/** "Chrome on Windows": a name to tell this device's passkey apart later. */
export function deviceName(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

/** The person closing the device's prompt is not an error worth shouting about. */
function friendly(e: unknown): AuthError {
  if (e instanceof AuthError) return e
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'AbortError') return new AuthError('That was cancelled. You can try again whenever you like.', 'cancelled', 0)
  if (name === 'InvalidStateError') return new AuthError('This device already has a passkey for your account.', 'already_added', 0)
  return new AuthError('Your device could not do that. Try again, or use your password.', 'passkey_error', 0)
}

export async function addPasskey(name = deviceName()): Promise<PasskeyInfo> {
  try {
    const optionsJSON = await apiCall<Parameters<typeof startRegistration>[0]['optionsJSON']>('/auth/passkeys/register/options', { body: {} })
    const response = await startRegistration({ optionsJSON })
    return (await apiCall<{ passkey: PasskeyInfo }>('/auth/passkeys/register/verify', { body: { response, name } })).passkey
  } catch (e) {
    throw friendly(e)
  }
}

export async function signInWithPasskey(): Promise<SessionState> {
  try {
    const { options, challengeId } = await apiCall<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON']; challengeId: string }>('/auth/passkeys/login/options', { body: {} })
    const response = await startAuthentication({ optionsJSON: options })
    return await apiCall<SessionState>('/auth/passkeys/login/verify', { body: { challengeId, response } })
  } catch (e) {
    throw friendly(e)
  }
}
