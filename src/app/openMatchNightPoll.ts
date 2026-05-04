import type { DomainError } from '../domain/errors.js'
import { conflict, notFound, validation } from '../domain/errors.js'
import { err, isErr, ok, type Result } from '../domain/result.js'
import type { MatchDataProvider, UpcomingMatch } from '../ports/matchData.js'
import type {
  MatchNightPollsRepository,
  MatchNightsRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { findNightByOrder, resolveMatchNights } from './matchNightLadder.js'

const POLL_CLOSE_OFFSET_MS = 24 * 60 * 60 * 1000

export type OpenMatchNightPollDeps = {
  teamRepo: TeamRepository
  matchNightsRepo: MatchNightsRepository
  pollsRepo: MatchNightPollsRepository
  provider: MatchDataProvider
  announcer: ScheduleAnnouncer
  now?: () => number
}

export type OpenMatchNightPollInput = {
  guildId: string
  preferenceOrder: number
}

export const openMatchNightPoll = async (
  deps: OpenMatchNightPollDeps,
  input: OpenMatchNightPollInput,
): Promise<Result<{ pollId: number; skipped: boolean }, DomainError>> => {
  const team = deps.teamRepo.findByGuild(input.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', input.guildId))
  if (!team.value.region) return err(validation('region', 'team region not configured'))
  if (!team.value.conference) return err(validation('conference', 'team conference not configured'))
  if (!team.value.announcementsChannelId)
    return err(validation('announcements_channel', 'channel not configured'))

  const nightsRes = deps.matchNightsRepo.listByGuild(input.guildId)
  if (isErr(nightsRes)) return nightsRes
  const nights = resolveMatchNights(input.guildId, nightsRes.value)
  const target = findNightByOrder(nights, input.preferenceOrder)
  if (!target) return err(notFound('match_night', `preference ${input.preferenceOrder}`))

  const open = deps.pollsRepo.findOpenForGuild(input.guildId)
  if (isErr(open)) return open
  if (open.value) return err(conflict('a poll is already open for this guild'))

  const sched = await deps.provider.getPremierSchedule(team.value.region, team.value.conference, 8)
  if (isErr(sched)) return sched

  const now = (deps.now ?? Date.now)()
  const upcoming = pickNextOnWeekday(sched.value, target.weekday, now)
  const matchStart = upcoming?.matchTimeStart ?? estimateNextWeekday(target.weekday, now)
  const matchEnd = upcoming?.matchTimeEnd ?? matchStart + 60 * 60 * 1000
  const mapName = upcoming?.mapName ?? null
  const closesAt = matchStart - POLL_CLOSE_OFFSET_MS

  const insertRes = deps.pollsRepo.insert({
    guildId: input.guildId,
    weekday: target.weekday,
    preferenceOrder: target.preferenceOrder,
    matchStartAt: matchStart,
    matchEndAt: matchEnd,
    mapName,
    messageId: null,
    status: 'open',
    closesAt,
    yesCount: 0,
    ladderDone: false,
    createdAt: now,
  })
  if (isErr(insertRes)) return insertRes

  const post = await deps.announcer.postMatchNightPoll({
    channelId: team.value.announcementsChannelId,
    pollId: insertRes.value,
    weekday: target.weekday,
    matchTimeStart: matchStart,
    mapName,
    closesAt,
    preferenceOrder: target.preferenceOrder,
    memberRoleId: team.value.memberRoleId,
  })
  if (isErr(post)) return post

  const setMsg = deps.pollsRepo.setMessageId(insertRes.value, post.value.messageId)
  if (isErr(setMsg)) return setMsg

  return ok({ pollId: insertRes.value, skipped: false })
}

const pickNextOnWeekday = (
  matches: UpcomingMatch[],
  weekday: number,
  now: number,
): UpcomingMatch | null => {
  for (const m of matches) {
    if (m.matchTimeStart <= now) continue
    const d = new Date(m.matchTimeStart)
    if (d.getUTCDay() === weekday) return m
  }
  return null
}

const estimateNextWeekday = (weekday: number, now: number): number => {
  const d = new Date(now)
  const cur = d.getUTCDay()
  let delta = (weekday - cur + 7) % 7
  if (delta === 0) delta = 7
  d.setUTCDate(d.getUTCDate() + delta)
  d.setUTCHours(22, 0, 0, 0)
  return d.getTime()
}
