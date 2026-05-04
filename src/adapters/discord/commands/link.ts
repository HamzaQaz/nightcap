import { SlashCommandBuilder } from 'discord.js'
import { linkPlayer } from '../../../app/linkPlayer.js'
import { isErr } from '../../../domain/result.js'
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const linkCommand = (
  provider: MatchDataProvider,
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Riot account (Name#TAG). Your captain still assigns your role.')
    .addStringOption((o) =>
      o.setName('riot-id').setDescription('Your Riot ID, e.g. Captain#NA1').setRequired(true),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    await interaction.deferReply({ ephemeral: true })
    const riotTag = interaction.options.getString('riot-id', true)
    const r = await linkPlayer({
      provider,
      playerRepo,
      input: {
        guildId: interaction.guildId,
        discordId: interaction.user.id,
        riotTag,
        addedBy: 'self',
      },
    })
    if (isErr(r)) {
      const msg =
        r.error.tag === 'validation'
          ? `Invalid Riot ID: ${r.error.message}`
          : r.error.tag === 'conflict'
            ? r.error.message
            : 'Could not link your account. Try again later.'
      await interaction.editReply({ content: msg })
      return
    }
    await interaction.editReply({
      content: `Linked **${r.value.riotName}#${r.value.riotTag}**. Your captain still needs to assign your in-game role with \`/roster set-role\`.`,
    })
  },
})

export const unlinkCommand = (playerRepo: PlayerRepository): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Riot account.') as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const r = playerRepo.remove(interaction.guildId, interaction.user.id)
    await interaction.reply({
      ephemeral: true,
      content: isErr(r) ? 'Failed to unlink.' : 'Unlinked.',
    })
  },
})
