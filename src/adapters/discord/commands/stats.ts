import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { computeSeasonStats } from '../../../app/seasonStats.js'
import { isErr } from '../../../domain/result.js'
import type { MatchRepository, PlayerRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const statsCommand = (
  matchRepo: MatchRepository,
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Team statistics.')
    .addSubcommand((s) =>
      s.setName('season').setDescription('Show team stats for the current Premier season.'),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()
    if (sub !== 'season') return

    const stats = computeSeasonStats({ matchRepo, playerRepo }, interaction.guildId)
    if (isErr(stats)) {
      await interaction.reply({ ephemeral: true, content: 'Failed to compute stats.' })
      return
    }
    const s = stats.value
    if (s.matchCount === 0) {
      await interaction.reply({
        ephemeral: true,
        content: 'No matches stored yet for this season.',
      })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle(`Season stats — ${s.seasonId ?? '(unknown season)'}`)
      .setDescription(
        `**Record**: ${s.wins}-${s.losses}${s.draws ? `-${s.draws}` : ''}${s.noResults ? ` (${s.noResults} no-result)` : ''} across ${s.matchCount} matches`,
      )

    if (s.perMap.length > 0) {
      embed.addFields({
        name: 'Per-map',
        value: s.perMap
          .map((m) => `**${m.map}**: ${m.wins}-${m.losses}${m.draws ? `-${m.draws}` : ''}`)
          .join('\n')
          .slice(0, 1024),
      })
    }

    if (s.perPlayer.length > 0) {
      embed.addFields({
        name: 'Per-player (sorted by ADR)',
        value: s.perPlayer
          .map(
            (p) =>
              `**${p.riotName}** — ${p.matches}m | K/D ${p.avgKD} | ADR ${p.avgADR} | HS% ${p.avgHsPct}\n  agents: ${p.topAgents.map((a) => `${a.agent} (${a.count})`).join(', ')}`,
          )
          .join('\n')
          .slice(0, 1024),
      })
    }

    await interaction.reply({ embeds: [embed] })
  },
})
