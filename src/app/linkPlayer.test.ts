import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type { PlayerRepository } from '../ports/repositories.js'
import { linkPlayer, parseRiotTag } from './linkPlayer.js'

describe('parseRiotTag', () => {
  it('splits Name#TAG', () => {
    const r = parseRiotTag('Captain#NA1')
    if (isOk(r)) expect(r.value).toEqual({ name: 'Captain', tag: 'NA1' })
    else throw new Error('expected ok')
  })

  it('rejects missing #', () => {
    expect(isErr(parseRiotTag('CaptainNA1'))).toBe(true)
  })

  it('rejects empty parts', () => {
    expect(isErr(parseRiotTag('#NA1'))).toBe(true)
    expect(isErr(parseRiotTag('Captain#'))).toBe(true)
  })
})

describe('linkPlayer', () => {
  const fakeProvider = (): MatchDataProvider =>
    ({
      resolveAccount: vi.fn().mockResolvedValue(ok({ puuid: 'PU-1', region: 'na' })),
    }) as unknown as MatchDataProvider

  const fakePlayerRepo = (): PlayerRepository =>
    ({ upsert: vi.fn().mockReturnValue(ok({ puuid: 'PU-1' })) }) as unknown as PlayerRepository

  it('verifies via provider then upserts the player', async () => {
    const p = fakeProvider()
    const repo = fakePlayerRepo()
    const r = await linkPlayer({
      provider: p,
      playerRepo: repo,
      input: { guildId: 'g1', discordId: 'u1', riotTag: 'Captain#NA1', addedBy: 'self' },
    })
    expect(isOk(r)).toBe(true)
    expect(p.resolveAccount).toHaveBeenCalledWith('Captain', 'NA1')
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ puuid: 'PU-1', riotName: 'Captain', riotTag: 'NA1' }),
    )
  })

  it('propagates provider errors', async () => {
    const p = {
      resolveAccount: vi
        .fn()
        .mockResolvedValue({ _tag: 'err' as const, error: { tag: 'provider_error' } }),
    } as unknown as MatchDataProvider
    const r = await linkPlayer({
      provider: p,
      playerRepo: fakePlayerRepo(),
      input: { guildId: 'g1', discordId: 'u1', riotTag: 'Captain#NA1', addedBy: 'self' },
    })
    expect(isErr(r)).toBe(true)
  })
})
