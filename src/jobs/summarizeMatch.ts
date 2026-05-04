import {
  type SummarizeDeps,
  summarizeMatchForPlayer,
  summarizeMatchForTeam,
} from '../app/summarizeMatch.js'
import { isErr } from '../domain/result.js'
import type { JobHandler } from './worker.js'

export type SummarizePlayerJobPayload = {
  kind: 'player'
  guildId: string
  matchId: string
  playerPuuid: string
  forceRefresh?: boolean
}

export type SummarizeTeamJobPayload = {
  kind: 'team'
  guildId: string
  matchId: string
  forceRefresh?: boolean
}

export type SummarizeJobPayload = SummarizePlayerJobPayload | SummarizeTeamJobPayload

export const SUMMARIZE_MATCH_JOB = 'summarizeMatch'

export const makeSummarizeMatchHandler =
  (deps: SummarizeDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as SummarizeJobPayload
    if (payload.kind === 'player') {
      const r = await summarizeMatchForPlayer(deps, {
        guildId: payload.guildId,
        matchId: payload.matchId,
        playerPuuid: payload.playerPuuid,
        forceRefresh: payload.forceRefresh ?? false,
      })
      if (isErr(r)) throw new Error(`summarizeMatchForPlayer failed: ${r.error.tag}`)
      return
    }
    const r = await summarizeMatchForTeam(deps, {
      guildId: payload.guildId,
      matchId: payload.matchId,
      forceRefresh: payload.forceRefresh ?? false,
    })
    if (isErr(r)) throw new Error(`summarizeMatchForTeam failed: ${r.error.tag}`)
  }
