import type { Client } from 'discord.js'
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type {
  JobRepository,
  MatchNightsRepository,
  MatchRepository,
  PlayerRepository,
  ScrimsRepository,
  TeamRepository,
  VodNotesRepository,
  VodsRepository,
} from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { matchCommand } from './match.js'
import { rosterCommand } from './roster.js'
import { scrimCommand } from './scrim.js'
import { statsCommand } from './stats.js'
import { teamCommand } from './team.js'
import { vodCommand } from './vod.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  matchRepo: MatchRepository
  jobRepo: JobRepository
  matchNightsRepo: MatchNightsRepository
  scrimRepo: ScrimsRepository
  vodsRepo: VodsRepository
  vodNotesRepo: VodNotesRepository
  provider: MatchDataProvider
  client: Client
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo, deps.matchNightsRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
  rosterCommand(deps.provider, deps.playerRepo),
  matchCommand(deps.matchRepo, deps.jobRepo, deps.playerRepo),
  scrimCommand(deps.scrimRepo),
  vodCommand(deps.vodsRepo, deps.vodNotesRepo, deps.teamRepo, deps.matchRepo, deps.client),
  statsCommand(deps.matchRepo, deps.playerRepo),
]
