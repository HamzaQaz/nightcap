import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { TeamRecord, TeamRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  henrik_team_id: string | null
  region: string | null
  conference: string | null
  captain_role_id: string | null
  member_role_id: string | null
  announcements_channel_id: string | null
  created_at: number
}

const toRecord = (r: Row): TeamRecord => ({
  guildId: r.guild_id,
  henrikTeamId: r.henrik_team_id,
  region: r.region,
  conference: r.conference,
  captainRoleId: r.captain_role_id,
  memberRoleId: r.member_role_id,
  announcementsChannelId: r.announcements_channel_id,
  createdAt: r.created_at,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Db) {}

  findByGuild(guildId: string): Result<TeamRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string], Row>('SELECT * FROM teams WHERE guild_id = ?')
        .get(guildId)
      return row ? toRecord(row) : null
    })
  }

  upsert(
    patch: Partial<TeamRecord> & { guildId: string },
  ): Result<TeamRecord, DomainError> {
    return wrap(() => {
      const existing = this.db
        .prepare<[string], Row>('SELECT * FROM teams WHERE guild_id = ?')
        .get(patch.guildId)
      const merged: TeamRecord = {
        guildId: patch.guildId,
        henrikTeamId: patch.henrikTeamId ?? existing?.henrik_team_id ?? null,
        region: patch.region ?? existing?.region ?? null,
        conference: patch.conference ?? existing?.conference ?? null,
        captainRoleId: patch.captainRoleId ?? existing?.captain_role_id ?? null,
        memberRoleId: patch.memberRoleId ?? existing?.member_role_id ?? null,
        announcementsChannelId:
          patch.announcementsChannelId ?? existing?.announcements_channel_id ?? null,
        createdAt: existing?.created_at ?? Date.now(),
      }
      this.db
        .prepare(
          `INSERT INTO teams (guild_id, henrik_team_id, region, conference, captain_role_id, member_role_id, announcements_channel_id, created_at)
           VALUES (@guildId, @henrikTeamId, @region, @conference, @captainRoleId, @memberRoleId, @announcementsChannelId, @createdAt)
           ON CONFLICT(guild_id) DO UPDATE SET
             henrik_team_id = excluded.henrik_team_id,
             region = excluded.region,
             conference = excluded.conference,
             captain_role_id = excluded.captain_role_id,
             member_role_id = excluded.member_role_id,
             announcements_channel_id = excluded.announcements_channel_id`,
        )
        .run(merged)
      return merged
    })
  }
}
