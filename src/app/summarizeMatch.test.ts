import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { AICoach, PlayerCoaching, TeamCoaching } from '../ports/aiCoach.js'
import type { CoachingAnnouncer } from '../ports/coachingAnnouncer.js'
import type {
  AISummariesRepository,
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../ports/repositories.js'
import { summarizeMatchForPlayer, summarizeMatchForTeam, TEAM_PUUID } from './summarizeMatch.js'

const playerCoaching: PlayerCoaching = {
  public: {
    tldr: 'Solid round',
    highlight: 'Big retake',
    focus_area: 'Smoke timing',
    role_involvement_pct: 78,
    role_involvement_one_liner: 'Held angles + retake util',
  },
  private: {
    tldr: 'Strong anchor; util timing slipped',
    did_well: ['Site holds', 'Trade timing'],
    improve: ['Earlier molly on retake'],
    coaching_tip: 'Pre-fire after smoke pop',
    role_involvement: {
      pct: 78,
      criteria: [{ name: 'Site anchor', score_pct: 85, evidence: 'Held B all D rounds' }],
    },
  },
}

const teamCoaching: TeamCoaching = {
  tldr: 'Strong A side',
  what_worked: ['A defaults'],
  what_to_fix: ['B exec timing'],
  next_match_focus: 'Drill B retake util order',
}

const team = {
  guildId: 'g1',
  henrikTeamId: 't1',
  region: 'na',
  conference: 'NA_US_WEST',
  captainRoleId: 'cap-role',
  memberRoleId: null,
  announcementsChannelId: 'ch1',
  createdAt: 0,
}

const match = {
  guildId: 'g1',
  matchId: 'M-1',
  seasonId: 'S-1',
  playedAt: 100,
  map: 'Ascent',
  result: 'win' as const,
  scoreUs: 13,
  scoreThem: 7,
  rawJson: '{"data":{"metadata":{"map":{"name":"Ascent"}}}}',
  threadId: 'thread-1',
}

const player = {
  guildId: 'g1',
  discordId: 'u1',
  riotName: 'Captain',
  riotTag: 'NA1',
  puuid: 'p1',
  role: 'controller',
  addedBy: 'self',
  createdAt: 0,
}

const fakeLogger = { warn: vi.fn(), error: vi.fn() }

const fakeDeps = (overrides: Record<string, unknown> = {}) => {
  const teamRepo = { findByGuild: vi.fn().mockReturnValue(ok(team)) } as unknown as TeamRepository
  const matchRepo = {
    findByMatchId: vi.fn().mockReturnValue(ok(match)),
  } as unknown as MatchRepository
  const playerRepo = {
    findByPuuid: vi.fn().mockReturnValue(ok(player)),
  } as unknown as PlayerRepository
  const aiSummariesRepo = {
    find: vi.fn().mockReturnValue(ok(null)),
    upsert: vi.fn().mockReturnValue(ok(undefined)),
  } as unknown as AISummariesRepository
  const coach = {
    summarizeMatchForPlayer: vi
      .fn()
      .mockResolvedValue(
        ok({ output: playerCoaching, model: 'gemini-2.5-flash', promptHash: 'h1' }),
      ),
    summarizeMatchForTeam: vi
      .fn()
      .mockResolvedValue(ok({ output: teamCoaching, model: 'gemini-2.5-flash', promptHash: 'h2' })),
  } as unknown as AICoach
  const announcer = {
    postInThread: vi.fn().mockResolvedValue(ok(undefined)),
    dmPlayer: vi.fn().mockResolvedValue(ok(undefined)),
    postCaptainNote: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as CoachingAnnouncer
  return {
    teamRepo,
    matchRepo,
    playerRepo,
    aiSummariesRepo,
    coach,
    announcer,
    logger: fakeLogger,
    now: () => 1000,
    ...overrides,
  }
}

beforeEach(() => {
  fakeLogger.warn.mockReset()
  fakeLogger.error.mockReset()
})

describe('summarizeMatchForPlayer', () => {
  it('calls Gemini, persists, posts public, DMs private', async () => {
    const deps = fakeDeps()
    const r = await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
    })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.delivered).toBe('public+dm')
    expect(deps.coach.summarizeMatchForPlayer).toHaveBeenCalled()
    expect(deps.aiSummariesRepo.upsert).toHaveBeenCalled()
    expect(deps.announcer.postInThread).toHaveBeenCalled()
    expect(deps.announcer.dmPlayer).toHaveBeenCalled()
  })

  it('uses cached output when prompt hash exists and forceRefresh=false', async () => {
    const deps = fakeDeps({
      aiSummariesRepo: {
        find: vi.fn().mockReturnValue(
          ok({
            guildId: 'g1',
            matchId: 'M-1',
            playerPuuid: 'p1',
            model: 'gemini-2.5-flash',
            promptHash: 'h1',
            output: JSON.stringify(playerCoaching),
            createdAt: 1000,
          }),
        ),
        upsert: vi.fn(),
      } as unknown as AISummariesRepository,
    })
    const r = await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
    })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) {
      expect(r.value.cached).toBe(true)
      expect(r.value.delivered).toBe('public+dm')
    }
    expect(deps.coach.summarizeMatchForPlayer).not.toHaveBeenCalled()
    expect(deps.aiSummariesRepo.upsert).not.toHaveBeenCalled()
  })

  it('forceRefresh=true bypasses cache', async () => {
    const deps = fakeDeps({
      aiSummariesRepo: {
        find: vi.fn().mockReturnValue(
          ok({
            guildId: 'g1',
            matchId: 'M-1',
            playerPuuid: 'p1',
            model: 'gemini-2.5-flash',
            promptHash: 'h1',
            output: JSON.stringify(playerCoaching),
            createdAt: 1000,
          }),
        ),
        upsert: vi.fn().mockReturnValue(ok(undefined)),
      } as unknown as AISummariesRepository,
    })
    await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
      forceRefresh: true,
    })
    expect(deps.coach.summarizeMatchForPlayer).toHaveBeenCalled()
    expect(deps.aiSummariesRepo.upsert).toHaveBeenCalled()
  })

  it('falls back to public-only when DM disabled', async () => {
    const deps = fakeDeps({
      announcer: {
        postInThread: vi.fn().mockResolvedValue(ok(undefined)),
        dmPlayer: vi.fn().mockResolvedValue({ _tag: 'err', error: { reason: 'dm_disabled' } }),
        postCaptainNote: vi.fn().mockResolvedValue(ok(undefined)),
      } as unknown as CoachingAnnouncer,
    })
    const r = await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
    })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.delivered).toBe('public-only')
    expect(deps.announcer.postCaptainNote).toHaveBeenCalled()
    expect(fakeLogger.warn).toHaveBeenCalled()
  })

  it('uses flex default when player.role is null and includes pre-role note in prompt + thread', async () => {
    const deps = fakeDeps({
      playerRepo: {
        findByPuuid: vi.fn().mockReturnValue(ok({ ...player, role: null })),
      } as unknown as PlayerRepository,
    })
    await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
    })
    const coachCalls = (deps.coach.summarizeMatchForPlayer as ReturnType<typeof vi.fn>).mock.calls
    expect(coachCalls[0]?.[0].role).toBe('flex')
    expect(coachCalls[0]?.[0].preRoleAssignment).toBe(true)
    const postCalls = (deps.announcer.postInThread as ReturnType<typeof vi.fn>).mock.calls
    expect(postCalls[0]?.[1]).toContain('No assigned role yet')
  })

  it('errs if match has no thread', async () => {
    const deps = fakeDeps({
      matchRepo: {
        findByMatchId: vi.fn().mockReturnValue(ok({ ...match, threadId: null })),
      } as unknown as MatchRepository,
    })
    const r = await summarizeMatchForPlayer(deps, {
      guildId: 'g1',
      matchId: 'M-1',
      playerPuuid: 'p1',
    })
    expect(isErr(r)).toBe(true)
  })
})

describe('summarizeMatchForTeam', () => {
  it('calls Gemini, persists under team puuid, posts to thread', async () => {
    const deps = fakeDeps()
    const r = await summarizeMatchForTeam(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isOk(r)).toBe(true)
    expect(deps.coach.summarizeMatchForTeam).toHaveBeenCalled()
    const upsertCalls = (deps.aiSummariesRepo.upsert as ReturnType<typeof vi.fn>).mock.calls
    expect(upsertCalls[0]?.[0].playerPuuid).toBe(TEAM_PUUID)
    expect(deps.announcer.postInThread).toHaveBeenCalled()
  })

  it('uses cached team output when present', async () => {
    const deps = fakeDeps({
      aiSummariesRepo: {
        find: vi.fn().mockReturnValue(
          ok({
            guildId: 'g1',
            matchId: 'M-1',
            playerPuuid: TEAM_PUUID,
            model: 'gemini-2.5-flash',
            promptHash: 'h1',
            output: JSON.stringify(teamCoaching),
            createdAt: 1000,
          }),
        ),
        upsert: vi.fn(),
      } as unknown as AISummariesRepository,
    })
    const r = await summarizeMatchForTeam(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.cached).toBe(true)
    expect(deps.coach.summarizeMatchForTeam).not.toHaveBeenCalled()
  })
})
