import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type {
  MatchNightPollRecord,
  MatchNightPollsRepository,
  PollRsvpRecord,
  PollRsvpsRepository,
} from '../../ports/repositories.js'
import type { Db } from './db.js'

type PollRow = {
  id: number
  guild_id: string
  weekday: number
  preference_order: number
  match_start_at: number
  match_end_at: number
  map_name: string | null
  message_id: string | null
  status: MatchNightPollRecord['status']
  closes_at: number
  yes_count: number
  ladder_done: number
  created_at: number
}

const toRecord = (r: PollRow): MatchNightPollRecord => ({
  id: r.id,
  guildId: r.guild_id,
  weekday: r.weekday,
  preferenceOrder: r.preference_order,
  matchStartAt: r.match_start_at,
  matchEndAt: r.match_end_at,
  mapName: r.map_name,
  messageId: r.message_id,
  status: r.status,
  closesAt: r.closes_at,
  yesCount: r.yes_count,
  ladderDone: r.ladder_done === 1,
  createdAt: r.created_at,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteMatchNightPollsRepository implements MatchNightPollsRepository {
  constructor(private readonly db: Db) {}

  insert(p: Omit<MatchNightPollRecord, 'id'>): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO match_night_polls
            (guild_id, weekday, preference_order, match_start_at, match_end_at, map_name, message_id, status, closes_at, yes_count, ladder_done, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          p.guildId,
          p.weekday,
          p.preferenceOrder,
          p.matchStartAt,
          p.matchEndAt,
          p.mapName,
          p.messageId,
          p.status,
          p.closesAt,
          p.yesCount,
          p.ladderDone ? 1 : 0,
          p.createdAt,
        )
      return Number(info.lastInsertRowid)
    })
  }

  setStatus(id: number, status: MatchNightPollRecord['status']): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare('UPDATE match_night_polls SET status = ? WHERE id = ?').run(status, id)
    })
  }

  setMessageId(id: number, messageId: string): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare('UPDATE match_night_polls SET message_id = ? WHERE id = ?')
        .run(messageId, id)
    })
  }

  setLadderDone(id: number, done: boolean): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare('UPDATE match_night_polls SET ladder_done = ? WHERE id = ?')
        .run(done ? 1 : 0, id)
    })
  }

  setYesCount(id: number, n: number): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare('UPDATE match_night_polls SET yes_count = ? WHERE id = ?').run(n, id)
    })
  }

  findById(id: number): Result<MatchNightPollRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[number], PollRow>('SELECT * FROM match_night_polls WHERE id = ?')
        .get(id)
      return row ? toRecord(row) : null
    })
  }

  findOpenForGuild(guildId: string): Result<MatchNightPollRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string], PollRow>(
          "SELECT * FROM match_night_polls WHERE guild_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1",
        )
        .get(guildId)
      return row ? toRecord(row) : null
    })
  }

  listClosingBefore(now: number): Result<MatchNightPollRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[number], PollRow>(
          "SELECT * FROM match_night_polls WHERE status = 'open' AND closes_at <= ?",
        )
        .all(now)
      return rows.map(toRecord)
    })
  }
}

type RsvpRow = {
  poll_id: number
  discord_id: string
  status: PollRsvpRecord['status']
  updated_at: number
}

export class SqlitePollRsvpsRepository implements PollRsvpsRepository {
  constructor(private readonly db: Db) {}

  upsert(r: PollRsvpRecord): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT INTO poll_rsvps (poll_id, discord_id, status, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(poll_id, discord_id) DO UPDATE SET
             status = excluded.status,
             updated_at = excluded.updated_at`,
        )
        .run(r.pollId, r.discordId, r.status, r.updatedAt)
    })
  }

  countYes(pollId: number): Result<number, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[number], { c: number }>(
          "SELECT COUNT(*) AS c FROM poll_rsvps WHERE poll_id = ? AND status = 'yes'",
        )
        .get(pollId)
      return row?.c ?? 0
    })
  }

  listByPoll(pollId: number): Result<PollRsvpRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[number], RsvpRow>('SELECT * FROM poll_rsvps WHERE poll_id = ?')
        .all(pollId)
      return rows.map((r) => ({
        pollId: r.poll_id,
        discordId: r.discord_id,
        status: r.status,
        updatedAt: r.updated_at,
      }))
    })
  }
}
