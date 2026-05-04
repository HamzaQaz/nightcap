import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteTeamRepository } from './teamRepo.js'

describe('SqliteTeamRepository', () => {
  let db: Db
  let repo: SqliteTeamRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteTeamRepository(db)
  })

  afterEach(() => db.close())

  it('returns null for unknown guild', () => {
    const r = repo.findByGuild('g1')
    if (isOk(r)) expect(r.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('upserts a new team and reads it back', () => {
    const u = repo.upsert({ guildId: 'g1', region: 'na', henrikTeamId: 't-1' })
    if (isErr(u)) throw new Error(JSON.stringify(u.error))
    expect(u.value.guildId).toBe('g1')
    expect(u.value.region).toBe('na')

    const r = repo.findByGuild('g1')
    if (isOk(r) && r.value) {
      expect(r.value.region).toBe('na')
      expect(r.value.henrikTeamId).toBe('t-1')
    } else {
      throw new Error('expected found team')
    }
  })

  it('upsert merges fields without clobbering unset ones', () => {
    repo.upsert({ guildId: 'g1', region: 'na', henrikTeamId: 't-1' })
    repo.upsert({ guildId: 'g1', captainRoleId: 'r-cap' })
    const r = repo.findByGuild('g1')
    if (isOk(r) && r.value) {
      expect(r.value.region).toBe('na')
      expect(r.value.henrikTeamId).toBe('t-1')
      expect(r.value.captainRoleId).toBe('r-cap')
    } else {
      throw new Error('expected found team')
    }
  })
})
