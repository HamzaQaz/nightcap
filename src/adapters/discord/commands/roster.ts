import { SlashCommandBuilder } from 'discord.js'
import { linkPlayer } from '../../../app/linkPlayer.js'
import { ROLES, setPlayerRole } from '../../../app/setPlayerRole.js'
import { isErr } from '../../../domain/result.js'
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const rosterCommand = (
  provider: MatchDataProvider,
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Manage the team roster (captain only).')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add or update a player.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true))
        .addStringOption((o) =>
          o.setName('riot-id').setDescription('Name#TAG').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('role')
            .setDescription('In-game role')
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a player from the roster.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('set-role')
        .setDescription('Assign a player\'s in-game role.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('role')
            .setDescription('In-game role')
            .setRequired(true)
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        ),
    ) as unknown as SlashCommandBuilder,
  permission: 'captain',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()
    const user = interaction.options.getUser('user', true)

    if (sub === 'remove') {
      const r = playerRepo.remove(interaction.guildId, user.id)
      await interaction.reply({
        ephemeral: true,
        content: isErr(r) ? 'Failed.' : `Removed <@${user.id}>.`,
      })
      return
    }

    if (sub === 'set-role') {
      const role = interaction.options.getString('role', true)
      const r = setPlayerRole(playerRepo, interaction.guildId, user.id, role)
      await interaction.reply({
        ephemeral: true,
        content: isErr(r)
          ? r.error.tag === 'validation'
            ? r.error.message
            : 'Failed.'
          : `Set <@${user.id}> role to **${role}**.`,
      })
      return
    }

    // add
    await interaction.deferReply({ ephemeral: true })
    const riotTag = interaction.options.getString('riot-id', true)
    const linked = await linkPlayer({
      provider,
      playerRepo,
      input: {
        guildId: interaction.guildId,
        discordId: user.id,
        riotTag,
        addedBy: interaction.user.id,
      },
    })
    if (isErr(linked)) {
      await interaction.editReply({
        content:
          linked.error.tag === 'validation'
            ? linked.error.message
            : linked.error.tag === 'conflict'
              ? linked.error.message
              : 'Failed to add player.',
      })
      return
    }
    const role = interaction.options.getString('role')
    if (role) {
      const rr = setPlayerRole(playerRepo, interaction.guildId, user.id, role)
      if (isErr(rr)) {
        await interaction.editReply({
          content: `Linked but role rejected: ${rr.error.tag === 'validation' ? rr.error.message : 'unknown'}`,
        })
        return
      }
    }
    await interaction.editReply({
      content: `Added <@${user.id}> as **${linked.value.riotName}#${linked.value.riotTag}**${
        role ? ` (${role})` : ''
      }.`,
    })
  },
})
