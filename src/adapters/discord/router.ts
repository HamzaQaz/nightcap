import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js'
import { recordPollRsvp, type RecordPollRsvpDeps } from '../../app/recordPollRsvp.js'
import { isErr } from '../../domain/result.js'
import type { TeamRepository } from '../../ports/repositories.js'
import { POLL_BUTTON_PREFIX } from './scheduleAnnouncer.js'
import type { CommandContext } from './command.js'
import { canRunCommand } from './permission.js'
import type { CommandRegistry } from './registry.js'

export type RouterDeps = {
  registry: CommandRegistry
  teamRepo: TeamRepository
  ctx: CommandContext
}

export type ButtonRouterDeps = {
  rsvpDeps: RecordPollRsvpDeps
  ctx: CommandContext
}

const isPollRsvpStatus = (s: string): s is 'yes' | 'no' | 'maybe' =>
  s === 'yes' || s === 'no' || s === 'maybe'

export const routeButton = async (
  interaction: ButtonInteraction,
  deps: ButtonRouterDeps,
): Promise<void> => {
  const id = interaction.customId
  if (!id.startsWith(`${POLL_BUTTON_PREFIX}:`)) return
  const [, pollIdStr, statusStr] = id.split(':')
  const pollId = Number(pollIdStr)
  if (!Number.isFinite(pollId) || !statusStr || !isPollRsvpStatus(statusStr)) {
    await interaction.reply({ content: 'Invalid poll button.', ephemeral: true })
    return
  }
  try {
    const r = await recordPollRsvp(deps.rsvpDeps, {
      pollId,
      discordId: interaction.user.id,
      status: statusStr,
    })
    if (isErr(r)) {
      await interaction.reply({
        content: r.error.tag === 'validation' ? 'Poll is closed.' : 'Could not record RSVP.',
        ephemeral: true,
      })
      return
    }
    await interaction.reply({
      content: `RSVP recorded: **${statusStr}** (poll #${pollId}, ${r.value.yesCount} ✅).`,
      ephemeral: true,
    })
  } catch (e) {
    deps.ctx.logger.error({ err: e, customId: id }, 'button handler failed')
    if (!interaction.replied)
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true })
  }
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
