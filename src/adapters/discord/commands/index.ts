import type { MatchDataProvider } from '../../../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { matchCommand } from './match.js'
import { rosterCommand } from './roster.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  matchRepo: MatchRepository
  jobRepo: JobRepository
  provider: MatchDataProvider
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
  rosterCommand(deps.provider, deps.playerRepo),
  matchCommand(deps.matchRepo, deps.jobRepo),
]
