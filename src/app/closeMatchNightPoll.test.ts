import { describe, expect, it, vi } from 'vitest'
import { isOk, ok } from '../domain/result.js'
import {
  CLOSE_MATCH_NIGHT_POLL_JOB,
  OPEN_MATCH_NIGHT_POLL_JOB,
  SEND_REMINDER_JOB,
} from '../jobs/jobKinds.js'
import type {
  JobRepository,
  MatchNightPollRecord,
  MatchNightPollsRepository,
  MatchNightsRepository,
  PollRsvpsRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { closeMatchNightPoll } from './closeMatchNightPoll.js'

void CLOSE_MATCH_NIGHT_POLL_JOB

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

const samplePoll: MatchNightPollRecord = {
  id: 1,
  guildId: 'g1',
  weekday: 6,
  preferenceOrder: 1,
  matchStartAt: Date.parse('2026-05-09T22:00:00.000Z'),
  matchEndAt: Date.parse('2026-05-09T23:00:00.000Z'),
  mapName: 'Ascent',
  messageId: 'msg1',
  status: 'open',
  closesAt: Date.parse('2026-05-08T22:00:00.000Z'),
  yesCount: 0,
  ladderDone: false,
  createdAt: Date.parse('2026-05-04T12:00:00.000Z'),
}

const fakeDeps = (overrides: Record<string, unknown> = {}) => {
  const teamRepo = { findByGuild: vi.fn().mockReturnValue(ok(team)) } as unknown as TeamRepository
  const pollsRepo = {
    findById: vi.fn().mockReturnValue(ok(samplePoll)),
    setStatus: vi.fn().mockReturnValue(ok(undefined)),
    setLadderDone: vi.fn().mockReturnValue(ok(undefined)),
    setYesCount: vi.fn().mockReturnValue(ok(undefined)),
  } as unknown as MatchNightPollsRepository
  const rsvpsRepo = {
    countYes: vi.fn().mockReturnValue(ok(0)),
  } as unknown as PollRsvpsRepository
  const matchNightsRepo = {
    listByGuild: vi.fn().mockReturnValue(ok([])),
  } as unknown as MatchNightsRepository
  const jobRepo = { enqueue: vi.fn().mockReturnValue(ok(1)) } as unknown as JobRepository
  const announcer = {
    postMatchNightPoll: vi.fn(),
    postSkipWeek: vi.fn().mockResolvedValue(ok(undefined)),
    postPlainAnnouncement: vi.fn().mockResolvedValue(ok(undefined)),
    updatePollMessage: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as ScheduleAnnouncer
  return {
    teamRepo,
    pollsRepo,
    rsvpsRepo,
    matchNightsRepo,
    jobRepo,
    announcer,
    quorum: 5,
    ...overrides,
  }
}

describe('closeMatchNightPoll', () => {
  it('quorum met → status=closed_quorum, schedules T-60 + T-10 reminders, ladder_done=true', async () => {
    const deps = fakeDeps({
      rsvpsRepo: { countYes: vi.fn().mockReturnValue(ok(5)) } as unknown as PollRsvpsRepository,
    })
    const r = await closeMatchNightPoll(deps, 1)
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.outcome).toBe('quorum_met')
    expect(deps.pollsRepo.setStatus).toHaveBeenCalledWith(1, 'closed_quorum')
    expect(deps.pollsRepo.setLadderDone).toHaveBeenCalledWith(1, true)
    const calls = (deps.jobRepo.enqueue as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0]?.[0]).toBe(SEND_REMINDER_JOB)
    expect(calls[0]?.[2]).toBe(samplePoll.matchStartAt - 60 * 60 * 1000)
    expect(calls[1]?.[2]).toBe(samplePoll.matchStartAt - 10 * 60 * 1000)
  })

  it('no quorum + has fallback → enqueues openMatchNightPoll for next preference', async () => {
    const deps = fakeDeps({
      rsvpsRepo: { countYes: vi.fn().mockReturnValue(ok(2)) } as unknown as PollRsvpsRepository,
    })
    const r = await closeMatchNightPoll(deps, 1)
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.outcome).toBe('no_quorum_fallback')
    const calls = (deps.jobRepo.enqueue as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe(OPEN_MATCH_NIGHT_POLL_JOB)
    expect(calls[0]?.[1]).toEqual({ guildId: 'g1', preferenceOrder: 2 })
    expect(deps.announcer.postPlainAnnouncement).toHaveBeenCalled()
  })

  it('no quorum + no fallback → posts skip-week message', async () => {
    const deps = fakeDeps({
      rsvpsRepo: { countYes: vi.fn().mockReturnValue(ok(1)) } as unknown as PollRsvpsRepository,
      matchNightsRepo: {
        listByGuild: vi
          .fn()
          .mockReturnValue(ok([{ guildId: 'g1', weekday: 6, preferenceOrder: 1 }])),
      } as unknown as MatchNightsRepository,
    })
    const r = await closeMatchNightPoll(deps, 1)
    expect(isOk(r)).toBe(true)
    if (isOk(r)) expect(r.value.outcome).toBe('no_quorum_skip_week')
    expect(deps.announcer.postSkipWeek).toHaveBeenCalled()
    expect(deps.pollsRepo.setLadderDone).toHaveBeenCalledWith(1, true)
  })
})
