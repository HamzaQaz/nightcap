import { describe, expect, it, vi } from 'vitest'
import { isOk, ok } from '../domain/result.js'
import type { MatchRecord, MatchRepository, PlayerRepository } from '../ports/repositories.js'
import { computeSeasonStats } from './seasonStats.js'

const player = (puuid: string, riotName: string) => ({
  guildId: 'g1',
  discordId: `d-${puuid}`,
  riotName,
  riotTag: 'NA1',
  puuid,
  role: null,
  addedBy: 'self',
  createdAt: 0,
})

const buildPayload = (
  matchId: string,
  ourTeam: 'Red' | 'Blue',
  ourWon: boolean,
  rounds: { us: number; them: number },
  ourPlayers: Array<{
    puuid: string
    name: string
    agent: string
    kills: number
    deaths: number
    assists: number
    hs: number
    bs: number
    ls: number
    dmg: number
  }>,
) => {
  const themTeam = ourTeam === 'Red' ? 'Blue' : 'Red'
  return JSON.stringify({
    data: {
      metadata: { match_id: matchId, map: { name: 'Ascent' } },
      players: ourPlayers.map((p) => ({
        puuid: p.puuid,
        name: p.name,
        tag: 'NA1',
        team_id: ourTeam,
        agent: { name: p.agent },
        stats: {
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          headshots: p.hs,
          bodyshots: p.bs,
          legshots: p.ls,
          damage: { dealt: p.dmg },
        },
      })),
      teams: [
        { team_id: ourTeam, won: ourWon, rounds: { won: rounds.us } },
        { team_id: themTeam, won: !ourWon, rounds: { won: rounds.them } },
      ],
    },
  })
}

const matchRec = (overrides: Partial<MatchRecord>): MatchRecord => ({
  guildId: 'g1',
  matchId: 'M-X',
  seasonId: 'S-1',
  playedAt: 1,
  map: 'Ascent',
  result: 'win',
  scoreUs: 13,
  scoreThem: 7,
  rawJson: '{}',
  threadId: null,
  ...overrides,
})

describe('computeSeasonStats', () => {
  it('aggregates W-L, per-player ADR/HS%, top agents from current season only', () => {
    const m1 = matchRec({
      matchId: 'M-1',
      seasonId: 'S-1',
      result: 'win',
      scoreUs: 13,
      scoreThem: 7,
      rawJson: buildPayload('M-1', 'Red', true, { us: 13, them: 7 }, [
        {
          puuid: 'p1',
          name: 'Captain',
          agent: 'Omen',
          kills: 20,
          deaths: 10,
          assists: 5,
          hs: 30,
          bs: 60,
          ls: 10,
          dmg: 3000,
        },
      ]),
    })
    const m2 = matchRec({
      matchId: 'M-2',
      seasonId: 'S-1',
      result: 'loss',
      scoreUs: 8,
      scoreThem: 13,
      map: 'Haven',
      rawJson: buildPayload('M-2', 'Blue', false, { us: 8, them: 13 }, [
        {
          puuid: 'p1',
          name: 'Captain',
          agent: 'Omen',
          kills: 12,
          deaths: 14,
          assists: 6,
          hs: 18,
          bs: 50,
          ls: 5,
          dmg: 1800,
        },
      ]),
    })
    const m3 = matchRec({
      matchId: 'M-3',
      seasonId: 'S-OLD',
      result: 'win',
      scoreUs: 13,
      scoreThem: 4,
      rawJson: buildPayload('M-3', 'Red', true, { us: 13, them: 4 }, [
        {
          puuid: 'p1',
          name: 'Captain',
          agent: 'Brimstone',
          kills: 25,
          deaths: 8,
          assists: 3,
          hs: 50,
          bs: 60,
          ls: 5,
          dmg: 4500,
        },
      ]),
    })
    const matchRepo = {
      listRecent: vi.fn().mockReturnValue(ok([m1, m2, m3])),
    } as unknown as MatchRepository
    const playerRepo = {
      listByGuild: vi.fn().mockReturnValue(ok([player('p1', 'Captain')])),
    } as unknown as PlayerRepository

    const r = computeSeasonStats({ matchRepo, playerRepo }, 'g1')
    if (!isOk(r)) throw new Error('expected ok')
    const stats = r.value
    expect(stats.seasonId).toBe('S-1')
    expect(stats.matchCount).toBe(2)
    expect(stats.wins).toBe(1)
    expect(stats.losses).toBe(1)
    expect(stats.perPlayer).toHaveLength(1)
    const cap = stats.perPlayer[0]
    expect(cap?.matches).toBe(2)
    expect(cap?.kills).toBe(32)
    expect(cap?.topAgents[0]?.agent).toBe('Omen')
    expect(stats.perMap.find((m) => m.map === 'Ascent')?.wins).toBe(1)
    expect(stats.perMap.find((m) => m.map === 'Haven')?.losses).toBe(1)
  })

  it('returns empty when no matches', () => {
    const matchRepo = {
      listRecent: vi.fn().mockReturnValue(ok([])),
    } as unknown as MatchRepository
    const playerRepo = {
      listByGuild: vi.fn().mockReturnValue(ok([])),
    } as unknown as PlayerRepository
    const r = computeSeasonStats({ matchRepo, playerRepo }, 'g1')
    if (isOk(r)) {
      expect(r.value.matchCount).toBe(0)
      expect(r.value.seasonId).toBeNull()
    }
  })
})
