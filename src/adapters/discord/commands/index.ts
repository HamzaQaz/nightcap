import type { TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
]
