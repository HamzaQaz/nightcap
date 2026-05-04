import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  MatchNightPollsRepository,
  MatchNightsRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { openMatchNightPoll } from './openMatchNightPoll.js'

const team = {
  guildId: 'g1',
  henrikTeamId: 't1',
  region: 'na',
  conference: 'NA_US_WEST',
  captainRoleId: null,
  memberRoleId: 'mr',
  announcementsChannelId: 'ch1',
  createdAt: 0,
}

const fakeDeps = (overrides: Record<string, unknown> = {}) => {
  const teamRepo = { findByGuild: vi.fn().mockReturnValue(ok(team)) } as unknown as TeamRepository
  const matchNightsRepo = {
    listByGuild: vi.fn().mockReturnValue(ok([])),
  } as unknown as MatchNightsRepository
  const pollsRepo = {
    findOpenForGuild: vi.fn().mockReturnValue(ok(null)),
    insert: vi.fn().mockReturnValue(ok(42)),
    setMessageId: vi.fn().mockReturnValue(ok(undefined)),
  } as unknown as MatchNightPollsRepository
  const provider = {
    getPremierSchedule: vi.fn().mockResolvedValue(
      ok([
        {
          matchTimeStart: Date.parse('2026-05-09T22:00:00.000Z'),
          matchTimeEnd: Date.parse('2026-05-09T23:00:00.000Z'),
          eventType: 'LEAGUE',
          mapName: 'Ascent',
          mapId: 'ascent',
          conference: 'NA_US_WEST',
          seasonId: 'season-active',
        },
      ]),
    ),
  } as unknown as MatchDataProvider
  const announcer = {
    postMatchNightPoll: vi.fn().mockResolvedValue(ok({ messageId: 'm1' })),
    postSkipWeek: vi.fn().mockResolvedValue(ok(undefined)),
    postPlainAnnouncement: vi.fn().mockResolvedValue(ok(undefined)),
    updatePollMessage: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as ScheduleAnnouncer
  return {
    teamRepo,
    matchNightsRepo,
    pollsRepo,
    provider,
    announcer,
    now: () => Date.parse('2026-05-04T12:00:00.000Z'),
    ...overrides,
  }
}

describe('openMatchNightPoll', () => {
  it('opens primary (SAT) poll using defaults when no match nights configured', async () => {
    const deps = fakeDeps()
    const r = await openMatchNightPoll(deps, { guildId: 'g1', preferenceOrder: 1 })
    expect(isOk(r)).toBe(true)
    const insertCall = (deps.pollsRepo.insert as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(insertCall?.[0].weekday).toBe(6) // Saturday
    expect(insertCall?.[0].mapName).toBe('Ascent')
    expect(insertCall?.[0].closesAt).toBe(
      Date.parse('2026-05-08T22:00:00.000Z'), // 24h before match
    )
    expect(deps.announcer.postMatchNightPoll).toHaveBeenCalled()
    expect(deps.pollsRepo.setMessageId).toHaveBeenCalledWith(42, 'm1')
  })

  it('opens fallback (SUN) poll when preferenceOrder=2', async () => {
    const deps = fakeDeps({
      provider: {
        getPremierSchedule: vi.fn().mockResolvedValue(
          ok([
            {
              matchTimeStart: Date.parse('2026-05-10T22:00:00.000Z'),
              matchTimeEnd: Date.parse('2026-05-10T23:00:00.000Z'),
              eventType: 'LEAGUE',
              mapName: 'Haven',
              mapId: 'haven',
              conference: 'NA_US_WEST',
              seasonId: 'season-active',
            },
          ]),
        ),
      } as unknown as MatchDataProvider,
    })
    const r = await openMatchNightPoll(deps, { guildId: 'g1', preferenceOrder: 2 })
    expect(isOk(r)).toBe(true)
    const insertCall = (deps.pollsRepo.insert as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(insertCall?.[0].weekday).toBe(0) // Sunday
    expect(insertCall?.[0].mapName).toBe('Haven')
  })

  it('refuses to open when another poll is already open', async () => {
    const deps = fakeDeps({
      pollsRepo: {
        findOpenForGuild: vi.fn().mockReturnValue(
          ok({
            id: 99,
            status: 'open',
            yesCount: 0,
            ladderDone: false,
          }),
        ),
        insert: vi.fn(),
        setMessageId: vi.fn(),
      } as unknown as MatchNightPollsRepository,
    })
    const r = await openMatchNightPoll(deps, { guildId: 'g1', preferenceOrder: 1 })
    expect(isErr(r)).toBe(true)
    expect(deps.pollsRepo.insert).not.toHaveBeenCalled()
  })

  it('uses TBD map when schedule has no upcoming match', async () => {
    const deps = fakeDeps({
      provider: {
        getPremierSchedule: vi.fn().mockResolvedValue(ok([])),
      } as unknown as MatchDataProvider,
    })
    const r = await openMatchNightPoll(deps, { guildId: 'g1', preferenceOrder: 1 })
    expect(isOk(r)).toBe(true)
    const insertCall = (deps.pollsRepo.insert as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(insertCall?.[0].mapName).toBeNull()
  })
})
