import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type { MatchNight, MatchNightsRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = { guild_id: string; weekday: number; preference_order: number }

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteMatchNightsRepository implements MatchNightsRepository {
  constructor(private readonly db: Db) {}

  upsert(n: MatchNight): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT INTO team_match_nights (guild_id, weekday, preference_order)
           VALUES (?, ?, ?)
           ON CONFLICT(guild_id, weekday) DO UPDATE SET preference_order = excluded.preference_order`,
        )
        .run(n.guildId, n.weekday, n.preferenceOrder)
    })
  }

  remove(guildId: string, weekday: number): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare('DELETE FROM team_match_nights WHERE guild_id = ? AND weekday = ?')
        .run(guildId, weekday)
    })
  }

  listByGuild(guildId: string): Result<MatchNight[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[string], Row>(
          'SELECT * FROM team_match_nights WHERE guild_id = ? ORDER BY preference_order ASC',
        )
        .all(guildId)
      return rows.map((r) => ({
        guildId: r.guild_id,
        weekday: r.weekday,
        preferenceOrder: r.preference_order,
      }))
    })
  }
}
