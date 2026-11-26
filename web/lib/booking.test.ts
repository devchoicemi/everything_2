import { describe, expect, it } from 'vitest'
import { BOOKING_SLOTS, formatSlotLabel, isValidBookingStartTime, parseTime } from './booking'

describe('parseTime', () => {
  it('parses valid 24h HH:mm', () => {
    expect(parseTime('12:00')).toEqual({ hour: 12, minute: 0 })
    expect(parseTime('9:05')).toEqual({ hour: 9, minute: 5 })
    expect(parseTime('19:00')).toEqual({ hour: 19, minute: 0 })
  })

  it('rejects malformed input', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime('noon')).toBeNull()
    expect(parseTime('25:00')).toBeNull()
    expect(parseTime('12:70')).toBeNull()
    expect(parseTime('12')).toBeNull()
  })
})

describe('isValidBookingStartTime — 12:00pm-7:00pm venue-local window', () => {
  it('accepts the lower boundary, 12:00', () => {
    expect(isValidBookingStartTime('12:00')).toBe(true)
  })

  it('accepts the upper boundary, 19:00 (7:00pm), inclusive', () => {
    expect(isValidBookingStartTime('19:00')).toBe(true)
  })

  it('rejects one minute before the window', () => {
    expect(isValidBookingStartTime('11:59')).toBe(false)
  })

  it('rejects one minute after the window', () => {
    expect(isValidBookingStartTime('19:01')).toBe(false)
  })

  it('rejects morning times', () => {
    expect(isValidBookingStartTime('08:30')).toBe(false)
    expect(isValidBookingStartTime('10:00')).toBe(false)
    expect(isValidBookingStartTime('11:30')).toBe(false)
  })

  it('rejects late evening times', () => {
    expect(isValidBookingStartTime('20:00')).toBe(false)
    expect(isValidBookingStartTime('23:59')).toBe(false)
  })

  it('rejects malformed/invalid submissions rather than throwing', () => {
    expect(isValidBookingStartTime('')).toBe(false)
    expect(isValidBookingStartTime('not a time')).toBe(false)
    expect(isValidBookingStartTime('25:00')).toBe(false)
    expect(isValidBookingStartTime('12:99')).toBe(false)
  })

  it('every offered slot is itself within the valid window', () => {
    for (const slot of BOOKING_SLOTS) {
      expect(isValidBookingStartTime(slot)).toBe(true)
    }
  })
})

describe('formatSlotLabel', () => {
  it('formats 24h times as friendly 12h labels', () => {
    expect(formatSlotLabel('12:00')).toBe('12pm')
    expect(formatSlotLabel('13:30')).toBe('1:30pm')
    expect(formatSlotLabel('19:00')).toBe('7pm')
    expect(formatSlotLabel('00:00')).toBe('12am')
  })
})
