import { SlashCommandBuilder } from 'discord.js'
import { isErr, isOk } from '../../../domain/result.js'
import { SUMMARIZE_MATCH_JOB } from '../../../jobs/summarizeMatch.js'
import type {
  JobRepository,
  MatchRepository,
  PlayerRepository,
} from '../../../ports/repositories.js'
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
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Match ingestion + coaching controls.')
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
    )
    .addSubcommand((s) =>
      s
        .setName('coach')
        .setDescription('Re-run AI coaching for one player on a specific match.')
        .addUserOption((o) =>
          o.setName('player').setDescription('Player to coach').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('match-id').setDescription('Henrik match id').setRequired(true),
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

    if (sub === 'link') {
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
      return
    }

    if (sub === 'coach') {
      const targetUser = interaction.options.getUser('player', true)
      const matchId = interaction.options.getString('match-id', true).trim()
      const player = playerRepo.findByDiscordId(interaction.guildId, targetUser.id)
      if (isErr(player)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to look up player.' })
        return
      }
      if (!player.value) {
        await interaction.reply({
          ephemeral: true,
          content: `<@${targetUser.id}> is not on the roster — captain must \`/roster add\` them first.`,
        })
        return
      }
      const matchExists = matchRepo.findByMatchId(interaction.guildId, matchId)
      if (isErr(matchExists) || !matchExists.value) {
        await interaction.reply({
          ephemeral: true,
          content: `No stored match with id \`${matchId}\`.`,
        })
        return
      }
      const e = jobRepo.enqueue(SUMMARIZE_MATCH_JOB, {
        kind: 'player',
        guildId: interaction.guildId,
        matchId,
        playerPuuid: player.value.puuid,
        forceRefresh: true,
      })
      await interaction.reply({
        ephemeral: true,
        content: isOk(e)
          ? `Coaching re-run queued for <@${targetUser.id}> on match \`${matchId}\`.`
          : 'Failed to enqueue.',
      })
      return
    }
  },
})
