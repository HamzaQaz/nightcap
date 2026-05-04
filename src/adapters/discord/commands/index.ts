import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository, TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  provider: MatchDataProvider
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
]
