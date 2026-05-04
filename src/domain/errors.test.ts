import { describe, expect, it } from 'vitest'
import {
  conflict,
  isDomainError,
  notFound,
  providerError,
  validation,
} from './errors.js'

describe('DomainError', () => {
  it('builds a not_found error', () => {
    const e = notFound('player', 'puuid:abc')
    expect(e.tag).toBe('not_found')
    expect(e.entity).toBe('player')
    expect(e.id).toBe('puuid:abc')
  })

  it('builds a validation error with field details', () => {
    const e = validation('riot_tag', 'must be 3-5 chars')
    expect(e.tag).toBe('validation')
    expect(e.field).toBe('riot_tag')
  })

  it('builds a conflict error', () => {
    const e = conflict('player already linked')
    expect(e.tag).toBe('conflict')
  })

  it('builds a provider_error with kind + message', () => {
    const e = providerError('henrik', 'rate_limited', 'try later')
    expect(e.tag).toBe('provider_error')
    expect(e.provider).toBe('henrik')
    expect(e.kind).toBe('rate_limited')
  })

  it('isDomainError narrows', () => {
    expect(isDomainError(notFound('x', 'y'))).toBe(true)
    expect(isDomainError({ random: true })).toBe(false)
  })
})
