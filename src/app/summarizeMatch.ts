import type { AICoach, PlayerCoaching, PlayerRole, TeamCoaching } from '../ports/aiCoach.js'
import { playerCoachingSchema, teamCoachingSchema } from '../ports/aiCoach.js'
import type { CoachingAnnouncer } from '../ports/coachingAnnouncer.js'
import type { Logger } from '../lib/logger.js'
import type {
  AISummariesRepository,
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { DomainError } from '../domain/errors.js'
import { notFound, validation } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import {
  PRE_ROLE_PUBLIC_NOTE,
  formatPlayerPrivate,
  formatPlayerPublic,
  formatTeam,
} from './coachingFormat.js'

export const TEAM_PUUID = 'team'

const VALID_ROLES = new Set(['duelist', 'initiator', 'controller', 'sentinel', 'flex'])

export type SummarizeDeps = {
  teamRepo: TeamRepository
  matchRepo: MatchRepository
  playerRepo: PlayerRepository
  aiSummariesRepo: AISummariesRepository
  coach: AICoach
  announcer: CoachingAnnouncer
  logger: Pick<Logger, 'warn' | 'error'>
  now?: () => number
}

export type SummarizePlayerInput = {
  guildId: string
  matchId: string
  playerPuuid: string
  forceRefresh?: boolean
}

export type SummarizeTeamInput = {
  guildId: string
  matchId: string
  forceRefresh?: boolean
}

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const loadCachedPlayer = (
  deps: SummarizeDeps,
  guildId: string,
  matchId: string,
  puuid: string,
): Result<PlayerCoaching | null, DomainError> => {
  const existing = deps.aiSummariesRepo.find(guildId, matchId, puuid)
  if (isErr(existing)) return existing
  if (!existing.value) return ok(null)
  const parsed = playerCoachingSchema.safeParse(safeJson(existing.value.output))
  return ok(parsed.success ? parsed.data : null)
}

const loadCachedTeam = (
  deps: SummarizeDeps,
  guildId: string,
  matchId: string,
): Result<TeamCoaching | null, DomainError> => {
  const existing = deps.aiSummariesRepo.find(guildId, matchId, TEAM_PUUID)
  if (isErr(existing)) return existing
  if (!existing.value) return ok(null)
  const parsed = teamCoachingSchema.safeParse(safeJson(existing.value.output))
  return ok(parsed.success ? parsed.data : null)
}

export const summarizeMatchForPlayer = async (
  deps: SummarizeDeps,
  input: SummarizePlayerInput,
): Promise<Result<{ delivered: 'public+dm' | 'public-only'; cached: boolean }, DomainError>> => {
  const team = deps.teamRepo.findByGuild(input.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', input.guildId))

  const match = deps.matchRepo.findByMatchId(input.guildId, input.matchId)
  if (isErr(match)) return match
  if (!match.value) return err(notFound('match', input.matchId))
  const threadId = match.value.threadId
  if (!threadId)
    return err(validation('thread', 'match has no thread; cannot post coaching'))

  const player = deps.playerRepo.findByPuuid(input.guildId, input.playerPuuid)
  if (isErr(player)) return player
  if (!player.value) return err(notFound('player', input.playerPuuid))

  const role: PlayerRole = VALID_ROLES.has(player.value.role ?? '')
    ? (player.value.role as PlayerRole)
    : 'flex'
  const preRoleAssignment = player.value.role === null

  let coaching: PlayerCoaching | null = null
  let cached = false
  if (!input.forceRefresh) {
    const cachedR = loadCachedPlayer(deps, input.guildId, input.matchId, input.playerPuuid)
    if (isErr(cachedR)) return cachedR
    if (cachedR.value) {
      coaching = cachedR.value
      cached = true
    }
  }

  if (!coaching) {
    const ai = await deps.coach.summarizeMatchForPlayer({
      matchId: input.matchId,
      matchRawJson: match.value.rawJson,
      puuid: player.value.puuid,
      riotName: player.value.riotName,
      role,
      preRoleAssignment,
    })
    if (isErr(ai)) return ai
    coaching = ai.value.output
    const persist = deps.aiSummariesRepo.upsert({
      guildId: input.guildId,
      matchId: input.matchId,
      playerPuuid: input.playerPuuid,
      model: ai.value.model,
      promptHash: ai.value.promptHash,
      output: JSON.stringify(ai.value.output),
      createdAt: (deps.now ?? Date.now)(),
    })
    if (isErr(persist)) return persist
  }

  const publicText = formatPlayerPublic(
    player.value.discordId,
    coaching.public,
    preRoleAssignment ? { preRoleNote: PRE_ROLE_PUBLIC_NOTE } : {},
  )
  const post = await deps.announcer.postInThread(threadId, publicText)
  if (isErr(post)) return post

  const privateText = formatPlayerPrivate(input.matchId, coaching.private)
  const dm = await deps.announcer.dmPlayer(player.value.discordId, privateText)
  if (isErr(dm)) {
    if (dm.error.reason === 'dm_disabled') {
      deps.logger.warn(
        { discordId: player.value.discordId, matchId: input.matchId },
        'dm_disabled — posting captain fallback note',
      )
      const note = `Couldn't DM <@${player.value.discordId}> their private coaching — they need to enable DMs from server members in Privacy Settings. Captain can run \`/match coach @user ${input.matchId}\` to retry.`
      await deps.announcer.postCaptainNote(threadId, team.value.captainRoleId, note)
      return ok({ delivered: 'public-only', cached })
    }
    deps.logger.error(
      { discordId: player.value.discordId, matchId: input.matchId, message: dm.error.message },
      'dm send failed',
    )
    return ok({ delivered: 'public-only', cached })
  }

  return ok({ delivered: 'public+dm', cached })
}

export const summarizeMatchForTeam = async (
  deps: SummarizeDeps,
  input: SummarizeTeamInput,
): Promise<Result<{ cached: boolean }, DomainError>> => {
  const match = deps.matchRepo.findByMatchId(input.guildId, input.matchId)
  if (isErr(match)) return match
  if (!match.value) return err(notFound('match', input.matchId))
  const threadId = match.value.threadId
  if (!threadId)
    return err(validation('thread', 'match has no thread; cannot post team coaching'))

  let coaching: TeamCoaching | null = null
  let cached = false
  if (!input.forceRefresh) {
    const cachedR = loadCachedTeam(deps, input.guildId, input.matchId)
    if (isErr(cachedR)) return cachedR
    if (cachedR.value) {
      coaching = cachedR.value
      cached = true
    }
  }

  if (!coaching) {
    const ai = await deps.coach.summarizeMatchForTeam({
      matchId: input.matchId,
      matchRawJson: match.value.rawJson,
    })
    if (isErr(ai)) return ai
    coaching = ai.value.output
    const persist = deps.aiSummariesRepo.upsert({
      guildId: input.guildId,
      matchId: input.matchId,
      playerPuuid: TEAM_PUUID,
      model: ai.value.model,
      promptHash: ai.value.promptHash,
      output: JSON.stringify(ai.value.output),
      createdAt: (deps.now ?? Date.now)(),
    })
    if (isErr(persist)) return persist
  }

  const post = await deps.announcer.postInThread(threadId, formatTeam(coaching))
  if (isErr(post)) return post
  return ok({ cached })
}
