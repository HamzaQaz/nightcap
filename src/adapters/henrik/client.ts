import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import { fetchJson } from '../../lib/http.js'
import type {
  MatchDataProvider,
  MatchDetail,
  MatchSummary,
  ResolvedAccount,
  ScoreboardRow,
  UpcomingMatch,
} from '../../ports/matchData.js'
import { resolveSchedule } from './schedule.js'
import {
  HenrikAccount,
  HenrikMatchDetail,
  type HenrikMatchDetailType,
  HenrikPremierHistory,
  HenrikSeasonsResponse,
  type HenrikSeasonsType,
} from './schemas.js'

const BASE = 'https://api.henrikdev.xyz/valorant'
const SCHEDULE_TTL_MS = 6 * 60 * 60 * 1000

export type HenrikOpts = {
  apiKey?: string | undefined
  baseUrl?: string
  now?: () => number
}

type CachedSchedule = { fetchedAt: number; data: HenrikSeasonsType }

export class HenrikClient implements MatchDataProvider {
  private readonly base: string
  private readonly headers: Record<string, string>
  private readonly now: () => number
  private readonly scheduleCache = new Map<string, CachedSchedule>()

  constructor(opts: HenrikOpts) {
    this.base = opts.baseUrl ?? BASE
    this.headers = { Accept: 'application/json' }
    if (opts.apiKey) this.headers.Authorization = opts.apiKey
    this.now = opts.now ?? (() => Date.now())
  }

  async resolveAccount(name: string, tag: string): Promise<Result<ResolvedAccount, DomainError>> {
    const url = `${this.base}/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 404) return err(providerError('henrik', 'unknown', 'account not found'))
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikAccount.safeParse(resp.json)
    if (!parsed.success) return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok({ puuid: parsed.data.data.puuid, region: parsed.data.data.region })
  }

  async listRecentMatches(
    region: string,
    teamId: string,
  ): Promise<Result<MatchSummary[], DomainError>> {
    const url = `${this.base}/v1/premier/${encodeURIComponent(teamId)}/history?region=${encodeURIComponent(region)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikPremierHistory.safeParse(resp.json)
    if (!parsed.success) return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok(
      parsed.data.data.matches.map((m) => ({
        matchId: m.id,
        playedAt: Date.parse(m.started_at),
        map: m.map?.name ?? null,
      })),
    )
  }

  async getMatchDetail(
    region: string,
    matchId: string,
    teamPuuids: string[],
  ): Promise<Result<MatchDetail, DomainError>> {
    const url = `${this.base}/v3/match/${encodeURIComponent(region)}/${encodeURIComponent(matchId)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikMatchDetail.safeParse(resp.json)
    if (!parsed.success) return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok(toMatchDetail(parsed.data, new Set(teamPuuids)))
  }

  async getPremierSchedule(
    region: string,
    conference: string,
    limit = 4,
  ): Promise<Result<UpcomingMatch[], DomainError>> {
    const now = this.now()
    const cacheKey = `${region}|${conference}`
    const cached = this.scheduleCache.get(cacheKey)
    let data: HenrikSeasonsType
    if (cached && now - cached.fetchedAt < SCHEDULE_TTL_MS) {
      data = cached.data
    } else {
      const url = `${this.base}/v1/premier/seasons/${encodeURIComponent(region)}`
      const resp = await fetchJson(url, { headers: this.headers })
      if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
      if (resp.status >= 400)
        return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
      const parsed = HenrikSeasonsResponse.safeParse(resp.json)
      if (!parsed.success) return err(providerError('henrik', 'bad_response', parsed.error.message))
      data = parsed.data
      this.scheduleCache.set(cacheKey, { fetchedAt: now, data })
    }
    return ok(resolveSchedule(data, conference, limit, now))
  }
}

const toMatchDetail = (raw: HenrikMatchDetailType, ourPuuids: Set<string>): MatchDetail => {
  const ourTeamId =
    raw.data.players.find((p) => ourPuuids.has(p.puuid))?.team_id ??
    raw.data.teams[0]?.team_id ??
    'Red'
  const us = raw.data.teams.find((t) => t.team_id === ourTeamId)
  const them = raw.data.teams.find((t) => t.team_id !== ourTeamId)
  const usWon = us?.won === true
  const themWon = them?.won === true
  const result: MatchDetail['result'] =
    usWon && !themWon ? 'win' : !usWon && themWon ? 'loss' : 'draw'

  const scoreboard: ScoreboardRow[] = raw.data.players.map((p) => {
    const totalShots = p.stats.headshots + p.stats.bodyshots + p.stats.legshots
    const hsPct = totalShots > 0 ? (p.stats.headshots / totalShots) * 100 : 0
    return {
      puuid: p.puuid,
      riotName: p.name,
      riotTag: p.tag,
      agent: p.agent.name,
      kills: p.stats.kills,
      deaths: p.stats.deaths,
      assists: p.stats.assists,
      adr: 0,
      hsPct: Number(hsPct.toFixed(1)),
    }
  })

  return {
    matchId: raw.data.metadata.match_id,
    seasonId: raw.data.metadata.season?.id ?? null,
    playedAt: Date.parse(raw.data.metadata.started_at),
    map: raw.data.metadata.map.name,
    result,
    scoreUs: us?.rounds.won ?? 0,
    scoreThem: them?.rounds.won ?? 0,
    ourPuuids: new Set(raw.data.players.filter((p) => p.team_id === ourTeamId).map((p) => p.puuid)),
    scoreboard,
    raw,
  }
}
