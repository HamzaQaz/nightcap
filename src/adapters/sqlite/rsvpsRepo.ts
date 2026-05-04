import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { RsvpRecord, RsvpsRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  scrim_id: number
  discord_id: string
  status: RsvpRecord['status']
  updated_at: number
}

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteRsvpsRepository implements RsvpsRepository {
  constructor(private readonly db: Db) {}

  upsert(r: RsvpRecord): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT INTO rsvps (scrim_id, discord_id, status, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(scrim_id, discord_id) DO UPDATE SET
             status = excluded.status,
             updated_at = excluded.updated_at`,
        )
        .run(r.scrimId, r.discordId, r.status, r.updatedAt)
    })
  }

  countYes(scrimId: number): Result<number, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[number], { c: number }>(
          "SELECT COUNT(*) AS c FROM rsvps WHERE scrim_id = ? AND status = 'yes'",
        )
        .get(scrimId)
      return row?.c ?? 0
    })
  }

  listByScrim(scrimId: number): Result<RsvpRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[number], Row>('SELECT * FROM rsvps WHERE scrim_id = ?')
        .all(scrimId)
      return rows.map((r) => ({
        scrimId: r.scrim_id,
        discordId: r.discord_id,
        status: r.status,
        updatedAt: r.updated_at,
      }))
    })
  }
}
