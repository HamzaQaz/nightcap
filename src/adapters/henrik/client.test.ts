import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { HenrikClient } from './client.js'

const accountFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/henrik/account.json'),
  'utf8',
)
const matchFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/henrik/match-detail.json'),
  'utf8',
)

describe('HenrikClient', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('resolves an account by name#tag', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(accountFixture, { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.resolveAccount('Captain', 'NA1')
    if (isOk(r)) {
      expect(r.value.puuid).toBe('PUUID-CAPTAIN')
      expect(r.value.region).toBe('na')
    } else throw new Error(JSON.stringify(r.error))
  })

  it('returns provider_error on bad response shape', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"unexpected":1}', { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.resolveAccount('Captain', 'NA1')
    if (isErr(r)) expect(r.error.tag).toBe('provider_error')
    else throw new Error('expected err')
  })

  it('parses a match detail and computes scoreUs/scoreThem from team puuids', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(matchFixture, { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.getMatchDetail('na', 'M-123', ['PUUID-CAPTAIN'])
    if (isOk(r)) {
      expect(r.value.matchId).toBe('M-123')
      expect(r.value.map).toBe('Ascent')
      expect(r.value.scoreUs).toBe(13)
      expect(r.value.scoreThem).toBe(7)
      expect(r.value.result).toBe('win')
      expect(r.value.seasonId).toBe('S-2026-A2')
      expect(r.value.scoreboard).toHaveLength(2)
    } else throw new Error(JSON.stringify(r.error))
  })
})
