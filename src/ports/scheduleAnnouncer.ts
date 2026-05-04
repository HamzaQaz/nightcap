import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export type MatchNightPollPostOpts = {
  channelId: string
  pollId: number
  weekday: number
  matchTimeStart: number
  mapName: string | null
  closesAt: number
  preferenceOrder: number
  memberRoleId: string | null
}

export interface ScheduleAnnouncer {
  postMatchNightPoll(
    opts: MatchNightPollPostOpts,
  ): Promise<Result<{ messageId: string }, DomainError>>
  postSkipWeek(channelId: string, content: string): Promise<Result<void, DomainError>>
  postPlainAnnouncement(channelId: string, content: string): Promise<Result<void, DomainError>>
  updatePollMessage(
    channelId: string,
    messageId: string,
    yesCount: number,
    quorum: number,
    closed: boolean,
  ): Promise<Result<void, DomainError>>
}
