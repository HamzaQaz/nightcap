import { describe, expect, it, vi } from 'vitest'
import { ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  TeamRecord,
  TeamRepository,
} from '../ports/repositories.js'
import { makePollPremierHandler } from './pollPremier.js'

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

describe('pollPremier handler', () => {
  it('enqueues ingestMatch jobs for new match ids only', async () => {
    const teamRepo = {
      findByGuild: vi.fn().mockReturnValue(ok(team)),
    } as unknown as TeamRepository
    const matchRepo = {
      findByMatchId: vi
        .fn()
        .mockImplementation((_g: string, id: string) =>
          ok(id === 'M-old' ? { matchId: 'M-old' } : null),
        ),
    } as unknown as MatchRepository
    const provider = {
      listRecentMatches: vi.fn().mockResolvedValue(
        ok([
          { matchId: 'M-old', playedAt: 1, map: 'Ascent' },
          { matchId: 'M-new', playedAt: 2, map: 'Bind' },
        ]),
      ),
    } as unknown as MatchDataProvider
    const enqueued: Array<{ kind: string; payload: unknown }> = []
    const jobRepo = {
      enqueue: vi.fn().mockImplementation((kind: string, payload: unknown) => {
        enqueued.push({ kind, payload })
        return ok(0)
      }),
    } as unknown as JobRepository

    const handler = makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })
    await handler({ guildId: 'g1' })

    expect(enqueued).toEqual([
      { kind: 'ingestMatch', payload: { guildId: 'g1', matchId: 'M-new' } },
    ])
  })

  it('no-ops when team has no henrik_team_id', async () => {
    const teamRepo = {
      findByGuild: vi.fn().mockReturnValue(ok({ ...team, henrikTeamId: null })),
    } as unknown as TeamRepository
    const provider = { listRecentMatches: vi.fn() } as unknown as MatchDataProvider
    const jobRepo = { enqueue: vi.fn() } as unknown as JobRepository
    const matchRepo = { findByMatchId: vi.fn() } as unknown as MatchRepository
    const handler = makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })
    await handler({ guildId: 'g1' })
    expect(provider.listRecentMatches).not.toHaveBeenCalled()
  })
})
