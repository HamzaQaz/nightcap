import type { DomainError } from '../domain/errors.js'
import { notFound, validation } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import type {
  JobRepository,
  MatchNightPollsRepository,
  MatchNightsRepository,
  PollRsvpsRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { OPEN_MATCH_NIGHT_POLL_JOB } from '../jobs/jobKinds.js'
import { SEND_REMINDER_JOB } from '../jobs/jobKinds.js'
import { WEEKDAY_NAMES, nextOrder, resolveMatchNights } from './matchNightLadder.js'

const REMINDER_OFFSETS_MS = [60 * 60 * 1000, 10 * 60 * 1000]

export type CloseMatchNightPollDeps = {
  teamRepo: TeamRepository
  pollsRepo: MatchNightPollsRepository
  rsvpsRepo: PollRsvpsRepository
  matchNightsRepo: MatchNightsRepository
  jobRepo: JobRepository
  announcer: ScheduleAnnouncer
  quorum?: number
  now?: () => number
}

export type CloseOutcome = 'quorum_met' | 'no_quorum_fallback' | 'no_quorum_skip_week'

export const closeMatchNightPoll = async (
  deps: CloseMatchNightPollDeps,
  pollId: number,
): Promise<Result<{ outcome: CloseOutcome; yesCount: number }, DomainError>> => {
  const quorum = deps.quorum ?? 5
  const poll = deps.pollsRepo.findById(pollId)
  if (isErr(poll)) return poll
  if (!poll.value) return err(notFound('match_night_poll', String(pollId)))
  if (poll.value.status !== 'open') return ok({ outcome: 'quorum_met', yesCount: poll.value.yesCount })

  const team = deps.teamRepo.findByGuild(poll.value.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', poll.value.guildId))
  const channelId = team.value.announcementsChannelId
  if (!channelId) return err(validation('announcements_channel', 'channel not configured'))

  const cnt = deps.rsvpsRepo.countYes(pollId)
  if (isErr(cnt)) return cnt
  const yesCount = cnt.value
  deps.pollsRepo.setYesCount(pollId, yesCount)

  if (yesCount >= quorum) {
    deps.pollsRepo.setStatus(pollId, 'closed_quorum')
    deps.pollsRepo.setLadderDone(pollId, true)
    if (poll.value.messageId)
      await deps.announcer.updatePollMessage(channelId, poll.value.messageId, yesCount, quorum, true)
    for (const offset of REMINDER_OFFSETS_MS) {
      const runAt = poll.value.matchStartAt - offset
      deps.jobRepo.enqueue(
        SEND_REMINDER_JOB,
        {
          guildId: poll.value.guildId,
          channelId,
          memberRoleId: team.value.memberRoleId,
          matchStartAt: poll.value.matchStartAt,
          mapName: poll.value.mapName,
          minutesAhead: offset / 60_000,
        },
        runAt,
      )
    }
    return ok({ outcome: 'quorum_met', yesCount })
  }

  deps.pollsRepo.setStatus(pollId, 'closed_no_quorum')
  if (poll.value.messageId)
    await deps.announcer.updatePollMessage(channelId, poll.value.messageId, yesCount, quorum, true)

  const nightsRes = deps.matchNightsRepo.listByGuild(poll.value.guildId)
  if (isErr(nightsRes)) return nightsRes
  const nights = resolveMatchNights(poll.value.guildId, nightsRes.value)
  const next = nextOrder(nights, poll.value.preferenceOrder)
  const weekdayName = WEEKDAY_NAMES[poll.value.weekday] ?? 'this night'

  if (next === null) {
    deps.pollsRepo.setLadderDone(pollId, true)
    await deps.announcer.postSkipWeek(
      channelId,
      `No quorum for ${weekdayName}${nights.length > 1 ? ' (or its fallback nights)' : ''} this week — Premier match skipped. We'll try again next Monday.`,
    )
    return ok({ outcome: 'no_quorum_skip_week', yesCount })
  }

  await deps.announcer.postPlainAnnouncement(
    channelId,
    `Not enough players for ${weekdayName} — opening fallback poll (preference ${next}).`,
  )
  deps.jobRepo.enqueue(OPEN_MATCH_NIGHT_POLL_JOB, {
    guildId: poll.value.guildId,
    preferenceOrder: next,
  })

  return ok({ outcome: 'no_quorum_fallback', yesCount })
}
