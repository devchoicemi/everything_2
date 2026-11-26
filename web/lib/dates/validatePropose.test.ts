import { describe, expect, it } from 'vitest'
import { validateProposeBody } from './validatePropose'

const VALID = { targetId: '1', dateKey: '2026-3-29', time: '13:30', venue: 'Kaffa Roastery' }

describe('validateProposeBody — "no typing during the connection process"', () => {
  it('accepts a well-formed request with no message field', () => {
    const result = validateProposeBody(VALID)
    expect(result.ok).toBe(true)
  })

  it('rejects a request carrying a "note" field, even a well-formed one', () => {
    const result = validateProposeBody({ ...VALID, note: 'hey, looking forward to it!' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no message field/i)
  })

  it('rejects a request carrying a "message" field', () => {
    const result = validateProposeBody({ ...VALID, message: 'hi there' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no message field/i)
  })

  it('rejects any other unrecognised field', () => {
    const result = validateProposeBody({ ...VALID, foo: 'bar' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unrecognised/i)
  })

  it('rejects a booking time outside 12:00-19:00', () => {
    const result = validateProposeBody({ ...VALID, time: '09:00' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/12:00pm and 7:00pm/i)
  })

  it('requires targetId, dateKey and venue', () => {
    expect(validateProposeBody({ ...VALID, targetId: '' }).ok).toBe(false)
    expect(validateProposeBody({ ...VALID, dateKey: '' }).ok).toBe(false)
    expect(validateProposeBody({ ...VALID, venue: '' }).ok).toBe(false)
  })

  it('the resulting payload never has a place for free text, structurally', () => {
    const result = validateProposeBody(VALID)
    if (result.ok) {
      expect(Object.keys(result).sort()).toEqual(['dateKey', 'ok', 'targetId', 'time', 'venue'])
    }
  })
})
