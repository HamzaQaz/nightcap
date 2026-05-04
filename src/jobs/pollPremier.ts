import { isErr } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type { JobRepository, MatchRepository, TeamRepository } from '../ports/repositories.js'
import type { JobHandler } from './worker.js'

export type PollPremierDeps = {
  teamRepo: TeamRepository
  matchRepo: MatchRepository
  provider: MatchDataProvider
  jobRepo: JobRepository
}

export type PollPremierPayload = { guildId: string }

export const makePollPremierHandler =
  (deps: PollPremierDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as PollPremierPayload
    const team = deps.teamRepo.findByGuild(payload.guildId)
    if (isErr(team) || !team.value) return
    if (!team.value.henrikTeamId || !team.value.region) return

    const list = await deps.provider.listRecentMatches(team.value.region, team.value.henrikTeamId)
    if (isErr(list)) throw new Error(`provider list failed: ${list.error.tag}`)

    for (const m of list.value) {
      const existing = deps.matchRepo.findByMatchId(payload.guildId, m.matchId)
      if (isErr(existing)) continue
      if (existing.value) continue
      deps.jobRepo.enqueue('ingestMatch', { guildId: payload.guildId, matchId: m.matchId })
    }
  }
