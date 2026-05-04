import { buildMatchEmbed } from '../adapters/discord/embeds/matchEmbed.js'
import type { DomainError } from '../domain/errors.js'
import { notFound, validation } from '../domain/errors.js'
import { err, isErr, ok, type Result } from '../domain/result.js'
import { SUMMARIZE_MATCH_JOB } from '../jobs/summarizeMatch.js'
import type { MatchAnnouncer } from '../ports/announcer.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../ports/repositories.js'

export type IngestMatchDeps = {
  teamRepo: TeamRepository
  matchRepo: MatchRepository
  playerRepo: PlayerRepository
  provider: MatchDataProvider
  announcer: MatchAnnouncer
  jobRepo: JobRepository
}

export type IngestMatchInput = { guildId: string; matchId: string }

export const ingestMatch = async (
  deps: IngestMatchDeps,
  input: IngestMatchInput,
): Promise<Result<{ skipped: boolean }, DomainError>> => {
  const existing = deps.matchRepo.findByMatchId(input.guildId, input.matchId)
  if (isErr(existing)) return existing
  if (existing.value) return ok({ skipped: true })

  const team = deps.teamRepo.findByGuild(input.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', input.guildId))
  if (!team.value.region) return err(validation('region', 'team region not configured'))
  if (!team.value.announcementsChannelId)
    return err(validation('announcements_channel', 'channel not configured'))

  const players = deps.playerRepo.listByGuild(input.guildId)
  if (isErr(players)) return players
  const teamPuuids = players.value.map((p) => p.puuid)

  const detail = await deps.provider.getMatchDetail(team.value.region, input.matchId, teamPuuids)
  if (isErr(detail)) return detail

  const insertResult = deps.matchRepo.insert({
    guildId: input.guildId,
    matchId: detail.value.matchId,
    seasonId: detail.value.seasonId,
    playedAt: detail.value.playedAt,
    map: detail.value.map,
    result: detail.value.result,
    scoreUs: detail.value.scoreUs,
    scoreThem: detail.value.scoreThem,
    rawJson: JSON.stringify(detail.value.raw),
    threadId: null,
  })
  if (isErr(insertResult)) return insertResult

  const embed = buildMatchEmbed(detail.value)
  const threadName = `${detail.value.map} ${detail.value.result.toUpperCase()} ${detail.value.scoreUs}-${detail.value.scoreThem}`
  const post = await deps.announcer.postMatch(
    input.guildId,
    team.value.announcementsChannelId,
    embed,
    threadName,
  )
  if (isErr(post)) return post

  const setThread = deps.matchRepo.setThreadId(
    input.guildId,
    detail.value.matchId,
    post.value.threadId,
  )
  if (isErr(setThread)) return setThread

  for (const puuid of detail.value.ourPuuids) {
    deps.jobRepo.enqueue(SUMMARIZE_MATCH_JOB, {
      kind: 'player',
      guildId: input.guildId,
      matchId: detail.value.matchId,
      playerPuuid: puuid,
    })
  }
  deps.jobRepo.enqueue(SUMMARIZE_MATCH_JOB, {
    kind: 'team',
    guildId: input.guildId,
    matchId: detail.value.matchId,
  })

  return ok({ skipped: false })
}
