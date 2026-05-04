import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'
import type { Logger } from '../../lib/logger.js'

export type CommandPermission = 'captain' | 'member' | 'anyone'

export type CommandContext = {
  logger: Logger
}

export type SlashCommand = {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
  permission: CommandPermission
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>
}
