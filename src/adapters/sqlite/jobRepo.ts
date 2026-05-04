import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type { JobRecord, JobRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  id: number
  kind: string
  payload_json: string
  run_at: number
  attempts: number
  last_error: string | null
  status: 'pending' | 'running' | 'done' | 'failed'
}

const toRecord = (r: Row): JobRecord => ({
  id: r.id,
  kind: r.kind,
  payloadJson: r.payload_json,
  runAt: r.run_at,
  attempts: r.attempts,
  lastError: r.last_error,
  status: r.status,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteJobRepository implements JobRepository {
  constructor(private readonly db: Db) {}

  enqueue(kind: string, payload: unknown, runAt = Date.now()): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO jobs (kind, payload_json, run_at, attempts, status)
           VALUES (?, ?, ?, 0, 'pending')`,
        )
        .run(kind, JSON.stringify(payload), runAt)
      return Number(info.lastInsertRowid)
    })
  }

  claimNext(now: number): Result<JobRecord | null, DomainError> {
    return wrap(() => {
      const tx = this.db.transaction(() => {
        const row = this.db
          .prepare<[number], Row>(
            `SELECT * FROM jobs
             WHERE status = 'pending' AND run_at <= ?
             ORDER BY run_at ASC, id ASC LIMIT 1`,
          )
          .get(now)
        if (!row) return null
        this.db
          .prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1 WHERE id = ?")
          .run(row.id)
        return toRecord({ ...row, status: 'running', attempts: row.attempts + 1 })
      })
      return tx()
    })
  }

  markDone(id: number): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(id)
    })
  }

  markFailed(id: number, error: string, nextRunAt: number | null): Result<void, DomainError> {
    return wrap(() => {
      if (nextRunAt === null) {
        this.db
          .prepare("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?")
          .run(error, id)
      } else {
        this.db
          .prepare("UPDATE jobs SET status = 'pending', last_error = ?, run_at = ? WHERE id = ?")
          .run(error, nextRunAt, id)
      }
    })
  }
}
