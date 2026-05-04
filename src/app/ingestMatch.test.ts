import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { MatchDataProvider, MatchDetail } from '../ports/matchData.js'
import type { MatchAnnouncer } from '../ports/announcer.js'
import type {
  MatchRepository,
  PlayerRepository,
  TeamRecord,
  TeamRepository,
} from '../ports/repositories.js'
import { ingestMatch } from './ingestMatch.js'

const team: TeamRecord = {
  guildId: 'g1',
  henrikTeamId: 't-1',
  region: 'na',
  conference: null,
  captainRoleId: null,
  memberRoleId: null,
  announcementsChannelId: 'ch-1',
  createdAt: 0,
}

const detail: MatchDetail = {
  matchId: 'M-1',
  seasonId: 'S-1',
  playedAt: 100,
  map: 'Ascent',
  result: 'win',
  scoreUs: 13,
  scoreThem: 7,
  ourPuuids: new Set(['p1']),
  scoreboard: [],
  raw: {},
}

const fakeDeps = (overrides: Partial<Parameters<typeof ingestMatch>[0]> = {}) => {
  const teamRepo = {
    findByGuild: vi.fn().mockReturnValue(ok(team)),
  } as unknown as TeamRepository
  const matchRepo = {
    findByMatchId: vi.fn().mockReturnValue(ok(null)),
    insert: vi.fn().mockReturnValue(ok(undefined)),
    setThreadId: vi.fn().mockReturnValue(ok(undefined)),
  } as unknown as MatchRepository
  const playerRepo = {
    listByGuild: vi
      .fn()
      .mockReturnValue(
        ok([{ puuid: 'p1', guildId: 'g1', discordId: 'u1', riotName: 'C', riotTag: 'NA1', role: null, addedBy: 'self', createdAt: 0 }]),
      ),
  } as unknown as PlayerRepository
  const provider = {
    getMatchDetail: vi.fn().mockResolvedValue(ok(detail)),
  } as unknown as MatchDataProvider
  const announcer = {
    postMatch: vi.fn().mockResolvedValue(ok({ threadId: 'thread-1' })),
  } as unknown as MatchAnnouncer
  return { teamRepo, matchRepo, playerRepo, provider, announcer, ...overrides }
}

describe('ingestMatch', () => {
  it('skips if match already exists', async () => {
    const deps = fakeDeps({
      matchRepo: {
        findByMatchId: vi.fn().mockReturnValue(ok({ matchId: 'M-1' })),
        insert: vi.fn(),
        setThreadId: vi.fn(),
      } as unknown as MatchRepository,
    })
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isOk(r)).toBe(true)
    expect(deps.provider.getMatchDetail).not.toHaveBeenCalled()
    expect(deps.announcer.postMatch).not.toHaveBeenCalled()
  })

  it('fetches detail, persists match, posts thread, stores threadId', async () => {
    const deps = fakeDeps()
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    if (isErr(r)) throw new Error(JSON.stringify(r.error))
    expect(deps.provider.getMatchDetail).toHaveBeenCalledWith('na', 'M-1', ['p1'])
    expect(deps.matchRepo.insert).toHaveBeenCalled()
    expect(deps.announcer.postMatch).toHaveBeenCalled()
    expect(deps.matchRepo.setThreadId).toHaveBeenCalledWith('g1', 'M-1', 'thread-1')
  })

  it('errs if team has no announcements channel', async () => {
    const deps = fakeDeps({
      teamRepo: {
        findByGuild: vi.fn().mockReturnValue(ok({ ...team, announcementsChannelId: null })),
      } as unknown as TeamRepository,
    })
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isErr(r)).toBe(true)
  })
})
