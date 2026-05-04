import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export type ResolvedAccount = { puuid: string; region: string }

export type MatchSummary = {
  matchId: string
  playedAt: number
  map: string | null
}

export type ScoreboardRow = {
  puuid: string
  riotName: string
  riotTag: string
  agent: string
  kills: number
  deaths: number
  assists: number
  adr: number
  hsPct: number
}

export type MatchDetail = {
  matchId: string
  seasonId: string | null
  playedAt: number
  map: string
  result: 'win' | 'loss' | 'draw' | 'no_result'
  scoreUs: number
  scoreThem: number
  ourPuuids: Set<string>
  scoreboard: ScoreboardRow[]
  raw: unknown
}

export type UpcomingMatch = {
  matchTimeStart: number
  matchTimeEnd: number
  eventType: 'LEAGUE' | 'SCRIM' | 'TOURNAMENT'
  mapName: string
  mapId: string
  conference: string
  seasonId: string
}

export interface MatchDataProvider {
  resolveAccount(name: string, tag: string): Promise<Result<ResolvedAccount, DomainError>>
  listRecentMatches(region: string, teamId: string): Promise<Result<MatchSummary[], DomainError>>
  getMatchDetail(
    region: string,
    matchId: string,
    teamPuuids: string[],
  ): Promise<Result<MatchDetail, DomainError>>
  getPremierSchedule(
    region: string,
    conference: string,
    limit?: number,
  ): Promise<Result<UpcomingMatch[], DomainError>>
}
