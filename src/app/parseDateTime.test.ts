import { describe, expect, it } from 'vitest'
import { isErr, isOk } from '../domain/result.js'
import { parseDateTime } from './parseDateTime.js'

describe('parseDateTime', () => {
  const now = Date.parse('2026-05-03T22:00:00.000Z')

  it('parses valid ISO date + HH:MM', () => {
    const r = parseDateTime('2027-01-15', '20:00', now)
    expect(isOk(r)).toBe(true)
  })

  it('rejects invalid date', () => {
    const r = parseDateTime('not-a-date', '20:00', now)
    expect(isErr(r)).toBe(true)
  })

  it('rejects invalid time', () => {
    const r = parseDateTime('2027-01-15', '99:99', now)
    expect(isErr(r)).toBe(true)
  })

  it('rejects past times', () => {
    const r = parseDateTime('2024-01-01', '20:00', now)
    if (isErr(r)) expect(r.error.tag).toBe('in_past')
    else throw new Error('expected error')
  })
})
