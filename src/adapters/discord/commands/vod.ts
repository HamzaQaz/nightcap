import {
  ChannelType,
  type Client,
  SlashCommandBuilder,
  type TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js'
import { formatVodTimestamp, parseVodTimestamp } from '../../../app/parseVodTimestamp.js'
import { isErr, isOk } from '../../../domain/result.js'
import type {
  MatchRepository,
  TeamRepository,
  VodNotesRepository,
  VodsRepository,
} from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

const URL_RE = /^https?:\/\/[^\s]+$/

export const vodCommand = (
  vodsRepo: VodsRepository,
  vodNotesRepo: VodNotesRepository,
  teamRepo: TeamRepository,
  matchRepo: MatchRepository,
  client: Client,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('vod')
    .setDescription('VOD library + timestamped review notes.')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add a VOD URL (and optionally link to a match).')
        .addStringOption((o) => o.setName('url').setDescription('VOD URL').setRequired(true))
        .addStringOption((o) => o.setName('match-id').setDescription('Optional Henrik match id')),
    )
    .addSubcommand((s) =>
      s
        .setName('note')
        .setDescription('Add a timestamped note to a VOD.')
        .addIntegerOption((o) =>
          o.setName('vod-id').setDescription('VOD id (from /vod add)').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('timestamp').setDescription('mm:ss or h:mm:ss').setRequired(true),
        )
        .addStringOption((o) => o.setName('text').setDescription('Note text').setRequired(true))
        .addUserOption((o) => o.setName('player').setDescription('Player tagged in note')),
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List recent VODs for this team.'),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'add') {
      const url = interaction.options.getString('url', true).trim()
      if (!URL_RE.test(url)) {
        await interaction.reply({ ephemeral: true, content: 'Invalid URL.' })
        return
      }
      const matchId = interaction.options.getString('match-id')?.trim() ?? null
      const ins = vodsRepo.insert({
        guildId: interaction.guildId,
        matchId,
        url,
        threadId: null,
        addedBy: interaction.user.id,
        createdAt: Date.now(),
      })
      if (isErr(ins)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to save VOD.' })
        return
      }

      let threadId: string | null = null
      try {
        if (matchId) {
          const match = matchRepo.findByMatchId(interaction.guildId, matchId)
          if (isOk(match) && match.value?.threadId) threadId = match.value.threadId
        }
        if (!threadId) {
          const team = teamRepo.findByGuild(interaction.guildId)
          if (isOk(team) && team.value?.announcementsChannelId) {
            const channel = await client.channels.fetch(team.value.announcementsChannelId)
            if (channel && channel.type === ChannelType.GuildText) {
              const text = channel as TextChannel
              const thread = await text.threads.create({
                name: `VOD #${ins.value}${matchId ? ` — ${matchId}` : ''}`.slice(0, 100),
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                type: ChannelType.PublicThread,
              })
              threadId = thread.id
              await thread.send({
                content: `**VOD #${ins.value}** added by <@${interaction.user.id}>\n${url}`,
              })
            }
          }
        }
        if (threadId) vodsRepo.setThreadId(ins.value, threadId)
      } catch {
        // Thread creation is best-effort; the VOD row is still persisted.
      }

      await interaction.reply({
        ephemeral: true,
        content: `Saved as VOD #${ins.value}${threadId ? ` (thread <#${threadId}>)` : ''}.`,
      })
      return
    }

    if (sub === 'note') {
      const vodId = interaction.options.getInteger('vod-id', true)
      const ts = interaction.options.getString('timestamp', true)
      const text = interaction.options.getString('text', true).trim()
      const target = interaction.options.getUser('player')
      const parsed = parseVodTimestamp(ts)
      if (isErr(parsed)) {
        await interaction.reply({
          ephemeral: true,
          content: 'Invalid timestamp. Use `mm:ss` or `h:mm:ss`.',
        })
        return
      }
      if (text.length === 0 || text.length > 500) {
        await interaction.reply({
          ephemeral: true,
          content: 'Note text must be 1-500 characters.',
        })
        return
      }
      const vod = vodsRepo.findById(vodId)
      if (isErr(vod) || !vod.value || vod.value.guildId !== interaction.guildId) {
        await interaction.reply({ ephemeral: true, content: `VOD #${vodId} not found.` })
        return
      }
      const ins = vodNotesRepo.insert({
        vodId,
        timestampSeconds: parsed.value,
        targetDiscordId: target?.id ?? null,
        authorDiscordId: interaction.user.id,
        text,
        createdAt: Date.now(),
      })
      if (isErr(ins)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to save note.' })
        return
      }

      const tsLabel = formatVodTimestamp(parsed.value)
      const playerTag = target ? ` <@${target.id}>` : ''
      const content = `**[${tsLabel}]**${playerTag} ${text}\n— <@${interaction.user.id}>`
      if (vod.value.threadId) {
        try {
          const thread = await client.channels.fetch(vod.value.threadId)
          if (thread && thread.isThread()) {
            await thread.send({ content, allowedMentions: { users: target ? [target.id] : [] } })
          }
        } catch {
          // best-effort thread post
        }
      }
      await interaction.reply({
        ephemeral: true,
        content: `Note added to VOD #${vodId} at ${tsLabel}.`,
      })
      return
    }

    if (sub === 'list') {
      const list = vodsRepo.listByGuild(interaction.guildId, 10)
      if (isErr(list)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to list VODs.' })
        return
      }
      if (list.value.length === 0) {
        await interaction.reply({ ephemeral: true, content: 'No VODs saved yet.' })
        return
      }
      const lines = list.value.map(
        (v) =>
          `#${v.id} <t:${Math.floor(v.createdAt / 1000)}:d>${v.matchId ? ` [match \`${v.matchId}\`]` : ''}\n  ${v.url}${v.threadId ? ` — <#${v.threadId}>` : ''}`,
      )
      await interaction.reply({ ephemeral: true, content: lines.join('\n') })
      return
    }
  },
})
