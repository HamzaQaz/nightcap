import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type { MatchRecord, MatchRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  match_id: string
  season_id: string | null
  played_at: number
  map: string | null
  result: 'win' | 'loss' | 'draw' | 'no_result' | null
  score_us: number | null
  score_them: number | null
  raw_json: string
  thread_id: string | null
}

const toRecord = (r: Row): MatchRecord => ({
  guildId: r.guild_id,
  matchId: r.match_id,
  seasonId: r.season_id,
  playedAt: r.played_at,
  map: r.map,
  result: r.result,
  scoreUs: r.score_us,
  scoreThem: r.score_them,
  rawJson: r.raw_json,
  threadId: r.thread_id,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteMatchRepository implements MatchRepository {
  constructor(private readonly db: Db) {}

  insert(m: MatchRecord): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO matches (guild_id, match_id, season_id, played_at, map, result, score_us, score_them, raw_json, thread_id)
           VALUES (@guildId, @matchId, @seasonId, @playedAt, @map, @result, @scoreUs, @scoreThem, @rawJson, @threadId)`,
        )
        .run(m)
    })
  }

  findByMatchId(guildId: string, matchId: string): Result<MatchRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string, string], Row>('SELECT * FROM matches WHERE guild_id = ? AND match_id = ?')
        .get(guildId, matchId)
      return row ? toRecord(row) : null
    })
  }

  setThreadId(guildId: string, matchId: string, threadId: string): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare('UPDATE matches SET thread_id = ? WHERE guild_id = ? AND match_id = ?')
        .run(threadId, guildId, matchId)
    })
  }

  listRecent(guildId: string, limit: number): Result<MatchRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[string, number], Row>(
          'SELECT * FROM matches WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?',
        )
        .all(guildId, limit)
      return rows.map(toRecord)
    })
  }
}
