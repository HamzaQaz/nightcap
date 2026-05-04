import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { err, isErr, type Result } from '../domain/result.js'
import type { TeamRecord, TeamRepository } from '../ports/repositories.js'

const REGIONS = new Set(['na', 'eu', 'ap', 'kr', 'latam', 'br'])
const CONFERENCE_RE = /^[A-Z]+(_[A-Z]+)+$/

export type SetTeamConfigInput = {
  guildId: string
  region?: string
  conference?: string
  henrikTeamId?: string
  captainRoleId?: string
  memberRoleId?: string
  announcementsChannelId?: string
}

export const setTeamConfig = (
  repo: TeamRepository,
  input: SetTeamConfigInput,
): Result<TeamRecord, DomainError> => {
  const patch: Partial<TeamRecord> & { guildId: string } = { guildId: input.guildId }
  if (input.region !== undefined) {
    const lower = input.region.toLowerCase()
    if (!REGIONS.has(lower))
      return err(validation('region', `must be one of ${[...REGIONS].join(', ')}`))
    patch.region = lower
  }
  if (input.conference !== undefined) {
    const upper = input.conference.toUpperCase()
    if (!CONFERENCE_RE.test(upper))
      return err(validation('conference', 'must be a Premier conference id like NA_US_WEST'))
    patch.conference = upper
  }
  if (input.henrikTeamId !== undefined) patch.henrikTeamId = input.henrikTeamId
  if (input.captainRoleId !== undefined) patch.captainRoleId = input.captainRoleId
  if (input.memberRoleId !== undefined) patch.memberRoleId = input.memberRoleId
  if (input.announcementsChannelId !== undefined)
    patch.announcementsChannelId = input.announcementsChannelId

  const r = repo.upsert(patch)
  if (isErr(r)) return r
  return r
}
