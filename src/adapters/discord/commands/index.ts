import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'

export const allCommands = (): SlashCommand[] => [helpCommand]
