import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Client,
  type EmbedBuilder,
  EmbedBuilder as Embed,
  type TextChannel,
} from 'discord.js'
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type {
  MatchNightPollPostOpts,
  ScheduleAnnouncer,
} from '../../ports/scheduleAnnouncer.js'
import { WEEKDAY_NAMES } from '../../app/matchNightLadder.js'

export const POLL_BUTTON_PREFIX = 'mnpoll'

const buildPollEmbed = (opts: MatchNightPollPostOpts): EmbedBuilder => {
  const e = new Embed()
    .setTitle(
      `Match-night poll: ${WEEKDAY_NAMES[opts.weekday]} (preference ${opts.preferenceOrder})`,
    )
    .setDescription(
      `Match starts <t:${Math.floor(opts.matchTimeStart / 1000)}:F>\nPoll closes <t:${Math.floor(opts.closesAt / 1000)}:R>${opts.mapName ? `\nMap: **${opts.mapName}**` : '\nMap: TBD'}\nQuorum: 5 ✅`,
    )
    .addFields({ name: 'RSVPs', value: '0 ✅', inline: true })
  return e
}

const buildPollRow = (pollId: number): ActionRowBuilder<ButtonBuilder> => {
  const yes = new ButtonBuilder()
    .setCustomId(`${POLL_BUTTON_PREFIX}:${pollId}:yes`)
    .setLabel('✅ Yes')
    .setStyle(ButtonStyle.Success)
  const maybe = new ButtonBuilder()
    .setCustomId(`${POLL_BUTTON_PREFIX}:${pollId}:maybe`)
    .setLabel('❓ Maybe')
    .setStyle(ButtonStyle.Secondary)
  const no = new ButtonBuilder()
    .setCustomId(`${POLL_BUTTON_PREFIX}:${pollId}:no`)
    .setLabel('❌ No')
    .setStyle(ButtonStyle.Danger)
  return new ActionRowBuilder<ButtonBuilder>().addComponents(yes, maybe, no)
}

export class DiscordScheduleAnnouncer implements ScheduleAnnouncer {
  constructor(private readonly client: Client) {}

  async postMatchNightPoll(
    opts: MatchNightPollPostOpts,
  ): Promise<Result<{ messageId: string }, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(opts.channelId)
      if (!channel || channel.type !== ChannelType.GuildText)
        return err(providerError('discord', 'unavailable', 'channel is not text'))
      const text = channel as TextChannel
      const ping = opts.memberRoleId ? `<@&${opts.memberRoleId}>` : ''
      const sendOpts: Parameters<typeof text.send>[0] = {
        embeds: [buildPollEmbed(opts)],
        components: [buildPollRow(opts.pollId)],
        allowedMentions: { roles: opts.memberRoleId ? [opts.memberRoleId] : [] },
      }
      if (ping) (sendOpts as { content: string }).content = ping
      const message = await text.send(sendOpts)
      return ok({ messageId: message.id })
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  async postSkipWeek(
    channelId: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    return this.postPlainAnnouncement(channelId, content)
  }

  async postPlainAnnouncement(
    channelId: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || channel.type !== ChannelType.GuildText)
        return err(providerError('discord', 'unavailable', 'channel is not text'))
      await (channel as TextChannel).send({ content, allowedMentions: { parse: [] } })
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  async updatePollMessage(
    channelId: string,
    messageId: string,
    yesCount: number,
    quorum: number,
    closed: boolean,
  ): Promise<Result<void, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || channel.type !== ChannelType.GuildText) return ok(undefined)
      const text = channel as TextChannel
      const message = await text.messages.fetch(messageId)
      const original = message.embeds[0]
      const e = original
        ? Embed.from(original)
        : new Embed().setTitle('Match-night poll')
      e.spliceFields(0, e.data.fields?.length ?? 0, {
        name: 'RSVPs',
        value: `${yesCount} ✅ / quorum ${quorum}${closed ? ' — closed' : ''}`,
        inline: true,
      })
      await message.edit({
        embeds: [e],
        components: closed ? [] : message.components,
      })
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }
}
