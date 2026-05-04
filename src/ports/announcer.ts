import type { APIEmbed } from 'discord.js'
import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export interface MatchAnnouncer {
  postMatch(
    guildId: string,
    channelId: string,
    embed: APIEmbed,
    threadName: string,
  ): Promise<Result<{ threadId: string }, DomainError>>
}
