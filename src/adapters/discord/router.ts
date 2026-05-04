import { type ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import type { TeamRepository } from '../../ports/repositories.js'
import type { CommandContext } from './command.js'
import { canRunCommand } from './permission.js'
import type { CommandRegistry } from './registry.js'

export type RouterDeps = {
  registry: CommandRegistry
  teamRepo: TeamRepository
  ctx: CommandContext
}

export const routeInteraction = async (
  interaction: ChatInputCommandInteraction,
  deps: RouterDeps,
): Promise<void> => {
  if (!interaction.isChatInputCommand()) return
  const cmd = deps.registry.get(interaction.commandName)
  if (!cmd) return

  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.reply({ content: 'This bot only works in servers.', ephemeral: true })
    return
  }

  const teamResult = deps.teamRepo.findByGuild(guildId)
  const team = teamResult._tag === 'ok' ? teamResult.value : null

  const member = interaction.member as {
    permissions?: { has: (p: bigint) => boolean }
    roles?: { cache: Map<string, unknown> }
  } | null
  const isAdmin = member?.permissions?.has?.(PermissionFlagsBits.Administrator) === true
  const userRoleIds = Array.from(member?.roles?.cache?.keys() ?? [])

  if (!canRunCommand(cmd.permission, { team, userRoleIds, isAdmin })) {
    await interaction.reply({
      content: `You don't have permission to run \`/${interaction.commandName}\`. Required: ${cmd.permission}.`,
      ephemeral: true,
    })
    return
  }

  try {
    await cmd.execute(interaction, deps.ctx)
  } catch (e) {
    deps.ctx.logger.error({ err: e, command: interaction.commandName }, 'command execution failed')
    const msg = 'Something went wrong running that command. Please try again.'
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: msg })
    } else {
      await interaction.reply({ content: msg, ephemeral: true })
    }
  }
}
