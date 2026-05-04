import { ChannelType, type Client, type ThreadChannel } from 'discord.js'
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { CoachingAnnouncer, DmFailure } from '../../ports/coachingAnnouncer.js'

const DM_DISABLED_CODE = 50007

export class DiscordCoachingAnnouncer implements CoachingAnnouncer {
  constructor(private readonly client: Client) {}

  async postInThread(threadId: string, content: string): Promise<Result<void, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(threadId)
      if (!channel || !channel.isThread()) {
        return err(providerError('discord', 'unavailable', `channel ${threadId} is not a thread`))
      }
      await (channel as ThreadChannel).send({
        content,
        allowedMentions: { parse: ['users'] },
      })
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  async dmPlayer(discordId: string, content: string): Promise<Result<void, DmFailure>> {
    try {
      const user = await this.client.users.fetch(discordId)
      await user.send({ content })
      return ok(undefined)
    } catch (e) {
      const code = (e as { code?: number }).code
      if (code === DM_DISABLED_CODE) {
        return err({ reason: 'dm_disabled' })
      }
      return err({ reason: 'other', message: (e as Error).message })
    }
  }

  async postCaptainNote(
    threadId: string,
    captainRoleId: string | null,
    content: string,
  ): Promise<Result<void, DomainError>> {
    const prefix = captainRoleId ? `<@&${captainRoleId}> ` : ''
    return this.postInThread(threadId, `${prefix}${content}`).then((r) => {
      if (r._tag === 'err') return r
      return ok(undefined)
    })
  }
}

export const isDmDisabled = (f: DmFailure): boolean => f.reason === 'dm_disabled'

export { DM_DISABLED_CODE }

void ChannelType
