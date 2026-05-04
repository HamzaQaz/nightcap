import {
  type APIEmbed,
  ChannelType,
  type Client,
  type TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js'
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type { MatchAnnouncer } from '../../ports/announcer.js'

export class DiscordMatchAnnouncer implements MatchAnnouncer {
  constructor(private readonly client: Client) {}

  async postMatch(
    _guildId: string,
    channelId: string,
    embed: APIEmbed,
    threadName: string,
  ): Promise<Result<{ threadId: string }, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || channel.type !== ChannelType.GuildText) {
        return err(
          providerError('discord', 'unavailable', 'announcements channel is not a text channel'),
        )
      }
      const text = channel as TextChannel
      const message = await text.send({ embeds: [embed] })
      const thread = await message.startThread({
        name: threadName.slice(0, 100),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      })
      return ok({ threadId: thread.id })
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }
}
