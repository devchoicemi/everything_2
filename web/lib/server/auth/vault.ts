import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Field-level encryption for sensitive identity data (AES-256-GCM).
 * The key is IDENTITY_DATA_KEY: 32 random bytes, base64 (openssl rand -base64 32).
 * Without it nothing sensitive is stored, so the feature fails closed.
 * Keep a copy of the key somewhere safe: data cannot be read without it.
 */
function key(): Buffer | null {
  const raw = process.env.IDENTITY_DATA_KEY?.trim()
  if (!raw) return null
  const k = Buffer.from(raw, 'base64')
  return k.length === 32 ? k : null
}

export function vaultConfigured(): boolean {
  return key() !== null
}

/** Returns `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptField(plain: string): string {
  const k = key()
  if (!k) throw new Error('IDENTITY_DATA_KEY is not set')
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k, iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.')
}

export function decryptField(stored: string): string {
  const k = key()
  if (!k) throw new Error('IDENTITY_DATA_KEY is not set')
  const [v, iv, tag, ct] = stored.split('.')
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('unknown format')
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
}
