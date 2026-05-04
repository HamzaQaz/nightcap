import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type { PlayerRecord, PlayerRepository } from '../ports/repositories.js'

export const parseRiotTag = (raw: string): Result<{ name: string; tag: string }, DomainError> => {
  const idx = raw.indexOf('#')
  if (idx <= 0 || idx === raw.length - 1)
    return err(validation('riot_tag', 'expected Name#TAG'))
  return ok({ name: raw.slice(0, idx), tag: raw.slice(idx + 1) })
}

export type LinkPlayerInput = {
  guildId: string
  discordId: string
  riotTag: string
  addedBy: string
}

export type LinkPlayerDeps = {
  provider: MatchDataProvider
  playerRepo: PlayerRepository
  input: LinkPlayerInput
}

export const linkPlayer = async (
  deps: LinkPlayerDeps,
): Promise<Result<PlayerRecord, DomainError>> => {
  const parsed = parseRiotTag(deps.input.riotTag)
  if (isErr(parsed)) return parsed
  const resolved = await deps.provider.resolveAccount(parsed.value.name, parsed.value.tag)
  if (isErr(resolved)) return resolved
  return deps.playerRepo.upsert({
    guildId: deps.input.guildId,
    discordId: deps.input.discordId,
    riotName: parsed.value.name,
    riotTag: parsed.value.tag,
    puuid: resolved.value.puuid,
    role: null,
    addedBy: deps.input.addedBy,
  })
}
