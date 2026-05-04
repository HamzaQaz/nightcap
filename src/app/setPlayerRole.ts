import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { err, type Result } from '../domain/result.js'
import type { PlayerRepository } from '../ports/repositories.js'

export const ROLES = ['duelist', 'initiator', 'controller', 'sentinel', 'flex'] as const
export type Role = (typeof ROLES)[number]

export const setPlayerRole = (
  repo: PlayerRepository,
  guildId: string,
  discordId: string,
  role: string,
): Result<void, DomainError> => {
  const lower = role.toLowerCase() as Role
  if (!ROLES.includes(lower)) return err(validation('role', `must be one of ${ROLES.join(', ')}`))
  return repo.setRole(guildId, discordId, lower)
}
