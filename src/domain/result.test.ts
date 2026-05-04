import { describe, expect, it } from 'vitest'
import { err, isErr, isOk, map, mapErr, ok, unwrap } from './result.js'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(isOk(r)).toBe(true)
    expect(isErr(r)).toBe(false)
    if (isOk(r)) expect(r.value).toBe(42)
  })

  it('err wraps an error', () => {
    const r = err('boom')
    expect(isErr(r)).toBe(true)
    if (isErr(r)) expect(r.error).toBe('boom')
  })

  it('map transforms Ok values', () => {
    const r = map(ok(2), (n) => n * 3)
    if (isOk(r)) expect(r.value).toBe(6)
  })

  it('map leaves Err untouched', () => {
    const r = map(err('x'), (n: number) => n * 3)
    if (isErr(r)) expect(r.error).toBe('x')
  })

  it('mapErr transforms Err values', () => {
    const r = mapErr(err('x'), (e) => `wrapped:${e}`)
    if (isErr(r)) expect(r.error).toBe('wrapped:x')
  })

  it('unwrap throws on Err', () => {
    expect(() => unwrap(err('boom'))).toThrow(/boom/)
  })

  it('unwrap returns value on Ok', () => {
    expect(unwrap(ok(7))).toBe(7)
  })
})
