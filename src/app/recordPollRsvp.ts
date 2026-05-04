import type { DomainError } from '../domain/errors.js'
import { notFound, validation } from '../domain/errors.js'
import { err, isErr, ok, type Result } from '../domain/result.js'
import type {
  MatchNightPollsRepository,
  PollRsvpsRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'

export type RecordPollRsvpDeps = {
  teamRepo: TeamRepository
  pollsRepo: MatchNightPollsRepository
  rsvpsRepo: PollRsvpsRepository
  announcer: ScheduleAnnouncer
  quorum?: number
  now?: () => number
}

export type RecordPollRsvpInput = {
  pollId: number
  discordId: string
  status: 'yes' | 'no' | 'maybe'
}

export const recordPollRsvp = async (
  deps: RecordPollRsvpDeps,
  input: RecordPollRsvpInput,
): Promise<Result<{ yesCount: number; closed: boolean }, DomainError>> => {
  const quorum = deps.quorum ?? 5
  const poll = deps.pollsRepo.findById(input.pollId)
  if (isErr(poll)) return poll
  if (!poll.value) return err(notFound('match_night_poll', String(input.pollId)))
  if (poll.value.status !== 'open') return err(validation('poll', 'poll is closed'))

  const team = deps.teamRepo.findByGuild(poll.value.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', poll.value.guildId))

  const upsert = deps.rsvpsRepo.upsert({
    pollId: input.pollId,
    discordId: input.discordId,
    status: input.status,
    updatedAt: (deps.now ?? Date.now)(),
  })
  if (isErr(upsert)) return upsert

  const cnt = deps.rsvpsRepo.countYes(input.pollId)
  if (isErr(cnt)) return cnt
  const yesCount = cnt.value
  deps.pollsRepo.setYesCount(input.pollId, yesCount)

  const closed = poll.value.status !== 'open'
  if (poll.value.messageId && team.value.announcementsChannelId)
    await deps.announcer.updatePollMessage(
      team.value.announcementsChannelId,
      poll.value.messageId,
      yesCount,
      quorum,
      closed,
    )

  return ok({ yesCount, closed })
}
