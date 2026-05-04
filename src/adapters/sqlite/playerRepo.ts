import type { DomainError } from '../../domain/errors.js'
import { conflict, providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { PlayerRecord, PlayerRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  discord_id: string
  riot_name: string
  riot_tag: string
  puuid: string
  role: string | null
  added_by: string
  created_at: number
}

const toRecord = (r: Row): PlayerRecord => ({
  guildId: r.guild_id,
  discordId: r.discord_id,
  riotName: r.riot_name,
  riotTag: r.riot_tag,
  puuid: r.puuid,
  role: r.role,
  addedBy: r.added_by,
  createdAt: r.created_at,
})

export class SqlitePlayerRepository implements PlayerRepository {
  constructor(private readonly db: Db) {}

  upsert(p: Omit<PlayerRecord, 'createdAt'>): Result<PlayerRecord, DomainError> {
    try {
      const createdAt = Date.now()
      this.db
        .prepare(
          `INSERT INTO players (guild_id, discord_id, riot_name, riot_tag, puuid, role, added_by, created_at)
           VALUES (@guildId, @discordId, @riotName, @riotTag, @puuid, @role, @addedBy, @createdAt)
           ON CONFLICT(guild_id, discord_id) DO UPDATE SET
             riot_name = excluded.riot_name,
             riot_tag = excluded.riot_tag,
             puuid = excluded.puuid,
             added_by = excluded.added_by`,
        )
        .run({ ...p, createdAt })
      return ok({ ...p, createdAt })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('UNIQUE') && msg.includes('players_puuid_per_guild')) {
        return err(conflict(`puuid ${p.puuid} is already linked to another Discord user`))
      }
      return err(providerError('discord', 'unknown', msg))
    }
  }

  setRole(guildId: string, discordId: string, role: string | null): Result<void, DomainError> {
    try {
      this.db
        .prepare('UPDATE players SET role = ? WHERE guild_id = ? AND discord_id = ?')
        .run(role, guildId, discordId)
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  remove(guildId: string, discordId: string): Result<void, DomainError> {
    try {
      this.db
        .prepare('DELETE FROM players WHERE guild_id = ? AND discord_id = ?')
        .run(guildId, discordId)
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  findByDiscordId(guildId: string, discordId: string): Result<PlayerRecord | null, DomainError> {
    try {
      const row = this.db
        .prepare<[string, string], Row>(
          'SELECT * FROM players WHERE guild_id = ? AND discord_id = ?',
        )
        .get(guildId, discordId)
      return ok(row ? toRecord(row) : null)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  findByPuuid(guildId: string, puuid: string): Result<PlayerRecord | null, DomainError> {
    try {
      const row = this.db
        .prepare<[string, string], Row>('SELECT * FROM players WHERE guild_id = ? AND puuid = ?')
        .get(guildId, puuid)
      return ok(row ? toRecord(row) : null)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  listByGuild(guildId: string): Result<PlayerRecord[], DomainError> {
    try {
      const rows = this.db
        .prepare<[string], Row>('SELECT * FROM players WHERE guild_id = ? ORDER BY created_at')
        .all(guildId)
      return ok(rows.map(toRecord))
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }
}
