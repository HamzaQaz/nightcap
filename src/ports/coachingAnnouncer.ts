import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export type DmFailure = { reason: 'dm_disabled' } | { reason: 'other'; message: string }

export interface CoachingAnnouncer {
  postInThread(threadId: string, content: string): Promise<Result<void, DomainError>>
  dmPlayer(discordId: string, content: string): Promise<Result<void, DmFailure>>
  postCaptainNote(
    threadId: string,
    captainRoleId: string | null,
    content: string,
  ): Promise<Result<void, DomainError>>
}
