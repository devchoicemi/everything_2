// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptField, encryptField, vaultConfigured } from '@/lib/server/auth/vault'

describe('field vault', () => {
  const saved = process.env.IDENTITY_DATA_KEY
  beforeEach(() => {
    process.env.IDENTITY_DATA_KEY = randomBytes(32).toString('base64')
  })
  afterEach(() => {
    process.env.IDENTITY_DATA_KEY = saved
  })

  it('round-trips and never leaks plaintext', () => {
    const c = encryptField('Åsa Öberg')
    expect(c).not.toContain('sa')
    expect(decryptField(c)).toBe('Åsa Öberg')
  })

  it('uses a fresh nonce each time', () => {
    expect(encryptField('same')).not.toBe(encryptField('same'))
  })

  it('refuses tampered data and the wrong key', () => {
    const c = encryptField('secret name')
    const parts = c.split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptField(parts.join('.'))).toThrow()
    process.env.IDENTITY_DATA_KEY = randomBytes(32).toString('base64')
    expect(() => decryptField(c)).toThrow()
  })

  it('is off without a valid 32-byte key', () => {
    process.env.IDENTITY_DATA_KEY = 'too-short'
    expect(vaultConfigured()).toBe(false)
    expect(() => encryptField('x')).toThrow()
  })
})
