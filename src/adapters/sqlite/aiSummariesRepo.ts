import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import type { AISummariesRepository, AISummaryRecord } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  match_id: string
  player_puuid: string
  model: string
  prompt_hash: string
  output: string
  created_at: number
}

const toRecord = (r: Row): AISummaryRecord => ({
  guildId: r.guild_id,
  matchId: r.match_id,
  playerPuuid: r.player_puuid,
  model: r.model,
  promptHash: r.prompt_hash,
  output: r.output,
  createdAt: r.created_at,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteAISummariesRepository implements AISummariesRepository {
  constructor(private readonly db: Db) {}

  upsert(r: AISummaryRecord): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT INTO ai_summaries (guild_id, match_id, player_puuid, model, prompt_hash, output, created_at)
           VALUES (@guildId, @matchId, @playerPuuid, @model, @promptHash, @output, @createdAt)
           ON CONFLICT(guild_id, match_id, player_puuid) DO UPDATE SET
             model = excluded.model,
             prompt_hash = excluded.prompt_hash,
             output = excluded.output,
             created_at = excluded.created_at`,
        )
        .run(r)
    })
  }

  find(
    guildId: string,
    matchId: string,
    playerPuuid: string,
  ): Result<AISummaryRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string, string, string], Row>(
          'SELECT * FROM ai_summaries WHERE guild_id = ? AND match_id = ? AND player_puuid = ?',
        )
        .get(guildId, matchId, playerPuuid)
      return row ? toRecord(row) : null
    })
  }
}
