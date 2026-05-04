import { describe, expect, it } from 'vitest'
import { isErr, isOk } from '../domain/result.js'
import { formatVodTimestamp, parseVodTimestamp } from './parseVodTimestamp.js'

describe('parseVodTimestamp', () => {
  it('parses MM:SS', () => {
    const r = parseVodTimestamp('5:30')
    if (isOk(r)) expect(r.value).toBe(330)
  })
  it('parses H:MM:SS', () => {
    const r = parseVodTimestamp('1:23:45')
    if (isOk(r)) expect(r.value).toBe(5025)
  })
  it('parses long MM:SS', () => {
    const r = parseVodTimestamp('120:00')
    if (isOk(r)) expect(r.value).toBe(7200)
  })
  it('rejects garbage', () => {
    expect(isErr(parseVodTimestamp('abc'))).toBe(true)
    expect(isErr(parseVodTimestamp('5'))).toBe(true)
    expect(isErr(parseVodTimestamp('5:99'))).toBe(true)
  })
})

describe('formatVodTimestamp', () => {
  it('formats short', () => {
    expect(formatVodTimestamp(330)).toBe('5:30')
  })
  it('formats long', () => {
    expect(formatVodTimestamp(5025)).toBe('1:23:45')
  })
})
