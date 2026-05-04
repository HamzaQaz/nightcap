import { SlashCommandBuilder } from 'discord.js'
import { isErr, isOk } from '../../../domain/result.js'
import type { JobRepository, MatchRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

const extractMatchId = (input: string): string | null => {
  const trimmed = input.trim()
  if (/^[A-Za-z0-9-]+$/.test(trimmed)) return trimmed
  const m = trimmed.match(/match\/(?:[a-z]+\/)?([A-Za-z0-9-]+)/i)
  return m?.[1] ?? null
}

export const matchCommand = (
  matchRepo: MatchRepository,
  jobRepo: JobRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Match ingestion controls.')
    .addSubcommand((s) =>
      s.setName('latest').setDescription('Re-ingest and re-post the most recent stored match.'),
    )
    .addSubcommand((s) =>
      s
        .setName('link')
        .setDescription('Manually ingest a match by URL or id.')
        .addStringOption((o) =>
          o.setName('id-or-url').setDescription('Henrik match id or tracker URL').setRequired(true),
        ),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'latest') {
      const recent = matchRepo.listRecent(interaction.guildId, 1)
      if (isErr(recent) || recent.value.length === 0) {
        await interaction.reply({
          ephemeral: true,
          content: 'No matches stored yet. Use `/match link` to ingest one manually.',
        })
        return
      }
      const m = recent.value[0]
      if (!m) return
      const e = jobRepo.enqueue('ingestMatch', {
        guildId: interaction.guildId,
        matchId: m.matchId,
      })
      await interaction.reply({
        ephemeral: true,
        content: isOk(e) ? `Re-ingest queued for match \`${m.matchId}\`.` : 'Failed to enqueue.',
      })
      return
    }

    // link
    const raw = interaction.options.getString('id-or-url', true)
    const id = extractMatchId(raw)
    if (!id) {
      await interaction.reply({
        ephemeral: true,
        content: 'Could not extract a match id from that input.',
      })
      return
    }
    const e = jobRepo.enqueue('ingestMatch', { guildId: interaction.guildId, matchId: id })
    await interaction.reply({
      ephemeral: true,
      content: isOk(e) ? `Ingest queued for match \`${id}\`.` : 'Failed to enqueue.',
    })
  },
})
