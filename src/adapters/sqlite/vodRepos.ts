import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type {
  VodNoteRecord,
  VodNotesRepository,
  VodRecord,
  VodsRepository,
} from '../../ports/repositories.js'
import type { Db } from './db.js'

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

type VodRow = {
  id: number
  guild_id: string
  match_id: string | null
  url: string
  thread_id: string | null
  added_by: string
  created_at: number
}

const toVod = (r: VodRow): VodRecord => ({
  id: r.id,
  guildId: r.guild_id,
  matchId: r.match_id,
  url: r.url,
  threadId: r.thread_id,
  addedBy: r.added_by,
  createdAt: r.created_at,
})

export class SqliteVodsRepository implements VodsRepository {
  constructor(private readonly db: Db) {}

  insert(v: Omit<VodRecord, 'id'>): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO vods (guild_id, match_id, url, thread_id, added_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(v.guildId, v.matchId, v.url, v.threadId, v.addedBy, v.createdAt)
      return Number(info.lastInsertRowid)
    })
  }

  setThreadId(id: number, threadId: string): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare('UPDATE vods SET thread_id = ? WHERE id = ?').run(threadId, id)
    })
  }

  findById(id: number): Result<VodRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db.prepare<[number], VodRow>('SELECT * FROM vods WHERE id = ?').get(id)
      return row ? toVod(row) : null
    })
  }

  listByGuild(guildId: string, limit: number): Result<VodRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[string, number], VodRow>(
          'SELECT * FROM vods WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?',
        )
        .all(guildId, limit)
      return rows.map(toVod)
    })
  }

  findByMatchId(guildId: string, matchId: string): Result<VodRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string, string], VodRow>(
          'SELECT * FROM vods WHERE guild_id = ? AND match_id = ? ORDER BY id DESC LIMIT 1',
        )
        .get(guildId, matchId)
      return row ? toVod(row) : null
    })
  }
}

type NoteRow = {
  id: number
  vod_id: number
  timestamp_seconds: number
  target_discord_id: string | null
  author_discord_id: string
  text: string
  created_at: number
}

const toNote = (r: NoteRow): VodNoteRecord => ({
  id: r.id,
  vodId: r.vod_id,
  timestampSeconds: r.timestamp_seconds,
  targetDiscordId: r.target_discord_id,
  authorDiscordId: r.author_discord_id,
  text: r.text,
  createdAt: r.created_at,
})

export class SqliteVodNotesRepository implements VodNotesRepository {
  constructor(private readonly db: Db) {}

  insert(n: Omit<VodNoteRecord, 'id'>): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO vod_notes (vod_id, timestamp_seconds, target_discord_id, author_discord_id, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(n.vodId, n.timestampSeconds, n.targetDiscordId, n.authorDiscordId, n.text, n.createdAt)
      return Number(info.lastInsertRowid)
    })
  }

  listByVod(vodId: number): Result<VodNoteRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[number], NoteRow>(
          'SELECT * FROM vod_notes WHERE vod_id = ? ORDER BY timestamp_seconds ASC, id ASC',
        )
        .all(vodId)
      return rows.map(toNote)
    })
  }
}
