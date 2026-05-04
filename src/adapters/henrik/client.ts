import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import { fetchJson } from '../../lib/http.js'
import type {
  MatchDataProvider,
  MatchDetail,
  MatchSummary,
  ResolvedAccount,
  ScoreboardRow,
} from '../../ports/matchData.js'
import {
  HenrikAccount,
  HenrikMatchDetail,
  type HenrikMatchDetailType,
  HenrikPremierHistory,
} from './schemas.js'

const BASE = 'https://api.henrikdev.xyz/valorant'

export type HenrikOpts = { apiKey?: string | undefined; baseUrl?: string }

export class HenrikClient implements MatchDataProvider {
  private readonly base: string
  private readonly headers: Record<string, string>

  constructor(opts: HenrikOpts) {
    this.base = opts.baseUrl ?? BASE
    this.headers = { Accept: 'application/json' }
    if (opts.apiKey) this.headers.Authorization = opts.apiKey
  }

  async resolveAccount(
    name: string,
    tag: string,
  ): Promise<Result<ResolvedAccount, DomainError>> {
    const url = `${this.base}/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 404) return err(providerError('henrik', 'unknown', 'account not found'))
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikAccount.safeParse(resp.json)
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
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
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
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
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok(toMatchDetail(parsed.data, new Set(teamPuuids)))
  }
}

const toMatchDetail = (
  raw: HenrikMatchDetailType,
  ourPuuids: Set<string>,
): MatchDetail => {
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
    ourPuuids: new Set(
      raw.data.players.filter((p) => p.team_id === ourTeamId).map((p) => p.puuid),
    ),
    scoreboard,
    raw,
  }
}
