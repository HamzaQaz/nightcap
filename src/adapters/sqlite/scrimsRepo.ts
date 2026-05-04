import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { ScrimRecord, ScrimsRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  id: number
  guild_id: string
  proposed_by: string
  start_at: number
  status: ScrimRecord['status']
  message_id: string | null
  note: string | null
  created_at: number
}

const toRecord = (r: Row): ScrimRecord => ({
  id: r.id,
  guildId: r.guild_id,
  proposedBy: r.proposed_by,
  startAt: r.start_at,
  status: r.status,
  messageId: r.message_id,
  note: r.note,
  createdAt: r.created_at,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteScrimsRepository implements ScrimsRepository {
  constructor(private readonly db: Db) {}

  insert(s: Omit<ScrimRecord, 'id'>): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO scrims (guild_id, proposed_by, start_at, status, message_id, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(s.guildId, s.proposedBy, s.startAt, s.status, s.messageId, s.note, s.createdAt)
      return Number(info.lastInsertRowid)
    })
  }

  setStatus(id: number, status: ScrimRecord['status']): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare('UPDATE scrims SET status = ? WHERE id = ?').run(status, id)
    })
  }

  setMessageId(id: number, messageId: string): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare('UPDATE scrims SET message_id = ? WHERE id = ?').run(messageId, id)
    })
  }

  findById(id: number): Result<ScrimRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db.prepare<[number], Row>('SELECT * FROM scrims WHERE id = ?').get(id)
      return row ? toRecord(row) : null
    })
  }

  listOpenByGuild(guildId: string): Result<ScrimRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[string], Row>(
          "SELECT * FROM scrims WHERE guild_id = ? AND status IN ('proposed', 'confirmed') ORDER BY start_at ASC",
        )
        .all(guildId)
      return rows.map(toRecord)
    })
  }
}
