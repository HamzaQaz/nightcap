import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from './http.js'

describe('fetchJson', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.useRealTimers()
  })

  it('returns parsed JSON on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const r = await fetchJson('https://x', { headers: {} })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('retries on 429 then succeeds', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    globalThis.fetch = mock
    const promise = fetchJson('https://x', { headers: {}, maxRetries: 1, baseDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(15)
    const r = await promise
    expect(r.status).toBe(200)
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('returns last response after exhausting retries', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('rate', { status: 429 }))
    const promise = fetchJson('https://x', { headers: {}, maxRetries: 2, baseDelayMs: 1 })
    await vi.runAllTimersAsync()
    const r = await promise
    expect(r.status).toBe(429)
  })
})
