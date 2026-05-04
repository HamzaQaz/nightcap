import type { Result } from '../domain/result.js'
import type { DomainError } from '../domain/errors.js'

export type TeamRecord = {
  guildId: string
  henrikTeamId: string | null
  region: string | null
  conference: string | null
  captainRoleId: string | null
  memberRoleId: string | null
  announcementsChannelId: string | null
  createdAt: number
}

export type PlayerRecord = {
  guildId: string
  discordId: string
  riotName: string
  riotTag: string
  puuid: string
  role: string | null
  addedBy: string
  createdAt: number
}

export type MatchRecord = {
  guildId: string
  matchId: string
  seasonId: string | null
  playedAt: number
  map: string | null
  result: 'win' | 'loss' | 'draw' | 'no_result' | null
  scoreUs: number | null
  scoreThem: number | null
  rawJson: string
  threadId: string | null
}

export type JobRecord = {
  id: number
  kind: string
  payloadJson: string
  runAt: number
  attempts: number
  lastError: string | null
  status: 'pending' | 'running' | 'done' | 'failed'
}

export interface TeamRepository {
  upsert(team: Partial<TeamRecord> & { guildId: string }): Result<TeamRecord, DomainError>
  findByGuild(guildId: string): Result<TeamRecord | null, DomainError>
}

export interface PlayerRepository {
  upsert(player: Omit<PlayerRecord, 'createdAt'>): Result<PlayerRecord, DomainError>
  setRole(guildId: string, discordId: string, role: string | null): Result<void, DomainError>
  remove(guildId: string, discordId: string): Result<void, DomainError>
  findByDiscordId(guildId: string, discordId: string): Result<PlayerRecord | null, DomainError>
  findByPuuid(guildId: string, puuid: string): Result<PlayerRecord | null, DomainError>
  listByGuild(guildId: string): Result<PlayerRecord[], DomainError>
}

export interface MatchRepository {
  insert(match: MatchRecord): Result<void, DomainError>
  findByMatchId(guildId: string, matchId: string): Result<MatchRecord | null, DomainError>
  setThreadId(guildId: string, matchId: string, threadId: string): Result<void, DomainError>
  listRecent(guildId: string, limit: number): Result<MatchRecord[], DomainError>
}

export interface JobRepository {
  enqueue(kind: string, payload: unknown, runAt?: number): Result<number, DomainError>
  claimNext(now: number): Result<JobRecord | null, DomainError>
  markDone(id: number): Result<void, DomainError>
  markFailed(id: number, error: string, nextRunAt: number | null): Result<void, DomainError>
}

export type AISummaryRecord = {
  guildId: string
  matchId: string
  playerPuuid: string
  model: string
  promptHash: string
  output: string
  createdAt: number
}

export interface AISummariesRepository {
  upsert(record: AISummaryRecord): Result<void, DomainError>
  find(
    guildId: string,
    matchId: string,
    playerPuuid: string,
  ): Result<AISummaryRecord | null, DomainError>
}

export type MatchNight = {
  guildId: string
  weekday: number
  preferenceOrder: number
}

export interface MatchNightsRepository {
  upsert(night: MatchNight): Result<void, DomainError>
  remove(guildId: string, weekday: number): Result<void, DomainError>
  listByGuild(guildId: string): Result<MatchNight[], DomainError>
}

export type ScrimRecord = {
  id: number
  guildId: string
  proposedBy: string
  startAt: number
  status: 'proposed' | 'confirmed' | 'cancelled' | 'past'
  messageId: string | null
  note: string | null
  createdAt: number
}

export interface ScrimsRepository {
  insert(scrim: Omit<ScrimRecord, 'id'>): Result<number, DomainError>
  setStatus(id: number, status: ScrimRecord['status']): Result<void, DomainError>
  setMessageId(id: number, messageId: string): Result<void, DomainError>
  findById(id: number): Result<ScrimRecord | null, DomainError>
  listOpenByGuild(guildId: string): Result<ScrimRecord[], DomainError>
}

export type RsvpRecord = {
  scrimId: number
  discordId: string
  status: 'yes' | 'no' | 'maybe'
  updatedAt: number
}

export interface RsvpsRepository {
  upsert(rsvp: RsvpRecord): Result<void, DomainError>
  countYes(scrimId: number): Result<number, DomainError>
  listByScrim(scrimId: number): Result<RsvpRecord[], DomainError>
}

export type MatchNightPollRecord = {
  id: number
  guildId: string
  weekday: number
  preferenceOrder: number
  matchStartAt: number
  matchEndAt: number
  mapName: string | null
  messageId: string | null
  status: 'open' | 'closed_quorum' | 'closed_no_quorum' | 'cancelled'
  closesAt: number
  yesCount: number
  ladderDone: boolean
  createdAt: number
}

export interface MatchNightPollsRepository {
  insert(p: Omit<MatchNightPollRecord, 'id'>): Result<number, DomainError>
  setStatus(id: number, status: MatchNightPollRecord['status']): Result<void, DomainError>
  setMessageId(id: number, messageId: string): Result<void, DomainError>
  setLadderDone(id: number, done: boolean): Result<void, DomainError>
  setYesCount(id: number, n: number): Result<void, DomainError>
  findById(id: number): Result<MatchNightPollRecord | null, DomainError>
  findOpenForGuild(guildId: string): Result<MatchNightPollRecord | null, DomainError>
  listClosingBefore(now: number): Result<MatchNightPollRecord[], DomainError>
}

export type PollRsvpRecord = {
  pollId: number
  discordId: string
  status: 'yes' | 'no' | 'maybe'
  updatedAt: number
}

export interface PollRsvpsRepository {
  upsert(r: PollRsvpRecord): Result<void, DomainError>
  countYes(pollId: number): Result<number, DomainError>
  listByPoll(pollId: number): Result<PollRsvpRecord[], DomainError>
}
