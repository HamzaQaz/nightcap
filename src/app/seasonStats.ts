import type { DomainError } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import { providerError } from '../domain/errors.js'
import type {
  MatchRecord,
  MatchRepository,
  PlayerRecord,
  PlayerRepository,
} from '../ports/repositories.js'

export type PlayerSeasonStats = {
  puuid: string
  riotName: string
  matches: number
  kills: number
  deaths: number
  assists: number
  avgKD: number
  avgADR: number
  avgHsPct: number
  topAgents: Array<{ agent: string; count: number }>
}

export type MapSeasonStat = { map: string; wins: number; losses: number; draws: number }

export type SeasonStats = {
  seasonId: string | null
  matchCount: number
  wins: number
  losses: number
  draws: number
  noResults: number
  perPlayer: PlayerSeasonStats[]
  perMap: MapSeasonStat[]
}

type RawMatchPayload = {
  data?: {
    metadata?: { season?: { id?: string } | null; map?: { name?: string } }
    players?: Array<{
      puuid: string
      name: string
      team_id: string
      agent?: { name?: string }
      stats?: {
        kills?: number
        deaths?: number
        assists?: number
        headshots?: number
        bodyshots?: number
        legshots?: number
        damage?: { dealt?: number }
      }
    }>
    teams?: Array<{ team_id: string; won: boolean }>
    metadata_rounds?: { total?: number }
    rounds?: Array<unknown>
  }
}

const safeParse = (raw: string): RawMatchPayload | null => {
  try {
    return JSON.parse(raw) as RawMatchPayload
  } catch {
    return null
  }
}

export type SeasonStatsDeps = {
  matchRepo: MatchRepository
  playerRepo: PlayerRepository
  fetchLimit?: number
}

export const computeSeasonStats = (
  deps: SeasonStatsDeps,
  guildId: string,
): Result<SeasonStats, DomainError> => {
  const recent = deps.matchRepo.listRecent(guildId, deps.fetchLimit ?? 100)
  if (isErr(recent)) return recent
  if (recent.value.length === 0) {
    return ok({
      seasonId: null,
      matchCount: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      noResults: 0,
      perPlayer: [],
      perMap: [],
    })
  }
  const seasonId = recent.value[0]?.seasonId ?? null
  const matches = recent.value.filter((m) => m.seasonId === seasonId)

  const playersRes = deps.playerRepo.listByGuild(guildId)
  if (isErr(playersRes)) return playersRes
  const ourPuuids = new Set(playersRes.value.map((p) => p.puuid))

  return ok(buildStats(seasonId, matches, playersRes.value, ourPuuids))
}

const buildStats = (
  seasonId: string | null,
  matches: MatchRecord[],
  players: PlayerRecord[],
  ourPuuids: Set<string>,
): SeasonStats => {
  const wins = matches.filter((m) => m.result === 'win').length
  const losses = matches.filter((m) => m.result === 'loss').length
  const draws = matches.filter((m) => m.result === 'draw').length
  const noResults = matches.filter((m) => m.result === 'no_result').length

  const perMapMap = new Map<string, MapSeasonStat>()
  for (const m of matches) {
    const key = m.map ?? 'unknown'
    const cur =
      perMapMap.get(key) ?? { map: key, wins: 0, losses: 0, draws: 0 }
    if (m.result === 'win') cur.wins++
    else if (m.result === 'loss') cur.losses++
    else if (m.result === 'draw') cur.draws++
    perMapMap.set(key, cur)
  }
  const perMap = [...perMapMap.values()].sort((a, b) => b.wins - a.wins)

  const playerAcc = new Map<
    string,
    {
      puuid: string
      riotName: string
      matches: number
      kills: number
      deaths: number
      assists: number
      hs: number
      shots: number
      damage: number
      rounds: number
      agentCounts: Map<string, number>
    }
  >()

  for (const p of players) {
    if (!ourPuuids.has(p.puuid)) continue
    playerAcc.set(p.puuid, {
      puuid: p.puuid,
      riotName: p.riotName,
      matches: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      hs: 0,
      shots: 0,
      damage: 0,
      rounds: 0,
      agentCounts: new Map(),
    })
  }

  for (const m of matches) {
    const payload = safeParse(m.rawJson)
    const playersInMatch = payload?.data?.players ?? []
    const teamRounds =
      (m.scoreUs ?? 0) + (m.scoreThem ?? 0) || payload?.data?.metadata_rounds?.total || 24
    for (const pp of playersInMatch) {
      if (!ourPuuids.has(pp.puuid)) continue
      const acc = playerAcc.get(pp.puuid)
      if (!acc) continue
      acc.matches += 1
      const k = pp.stats?.kills ?? 0
      const d = pp.stats?.deaths ?? 0
      const a = pp.stats?.assists ?? 0
      const hs = pp.stats?.headshots ?? 0
      const bs = pp.stats?.bodyshots ?? 0
      const ls = pp.stats?.legshots ?? 0
      const dmg = pp.stats?.damage?.dealt ?? 0
      acc.kills += k
      acc.deaths += d
      acc.assists += a
      acc.hs += hs
      acc.shots += hs + bs + ls
      acc.damage += dmg
      acc.rounds += teamRounds
      const ag = pp.agent?.name ?? 'Unknown'
      acc.agentCounts.set(ag, (acc.agentCounts.get(ag) ?? 0) + 1)
    }
  }

  const perPlayer: PlayerSeasonStats[] = []
  for (const acc of playerAcc.values()) {
    if (acc.matches === 0) continue
    const avgKD = acc.deaths === 0 ? acc.kills : acc.kills / acc.deaths
    const avgADR = acc.rounds === 0 ? 0 : acc.damage / acc.rounds
    const avgHsPct = acc.shots === 0 ? 0 : (acc.hs / acc.shots) * 100
    const topAgents = [...acc.agentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([agent, count]) => ({ agent, count }))
    perPlayer.push({
      puuid: acc.puuid,
      riotName: acc.riotName,
      matches: acc.matches,
      kills: acc.kills,
      deaths: acc.deaths,
      assists: acc.assists,
      avgKD: Number(avgKD.toFixed(2)),
      avgADR: Number(avgADR.toFixed(1)),
      avgHsPct: Number(avgHsPct.toFixed(1)),
      topAgents,
    })
  }
  perPlayer.sort((a, b) => b.avgADR - a.avgADR)

  return {
    seasonId,
    matchCount: matches.length,
    wins,
    losses,
    draws,
    noResults,
    perPlayer,
    perMap,
  }
}

void providerError
void err
