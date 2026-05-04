import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqlitePlayerRepository } from './playerRepo.js'

const sample = {
  guildId: 'g1',
  discordId: 'u1',
  riotName: 'Player',
  riotTag: 'NA1',
  puuid: 'pu-1',
  role: null,
  addedBy: 'self',
}

describe('SqlitePlayerRepository', () => {
  let db: Db
  let repo: SqlitePlayerRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqlitePlayerRepository(db)
  })

  afterEach(() => db.close())

  it('upserts a new player and finds them', () => {
    const u = repo.upsert(sample)
    if (isErr(u)) throw new Error(JSON.stringify(u.error))

    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) {
      expect(f.value.puuid).toBe('pu-1')
      expect(f.value.role).toBeNull()
    } else throw new Error('expected found')
  })

  it('upsert overwrites tag/puuid for the same discord_id', () => {
    repo.upsert(sample)
    repo.upsert({ ...sample, riotTag: 'EU1', puuid: 'pu-2' })
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) {
      expect(f.value.riotTag).toBe('EU1')
      expect(f.value.puuid).toBe('pu-2')
    } else throw new Error('expected found')
  })

  it('rejects duplicate puuid for different discord users in same guild', () => {
    repo.upsert(sample)
    const r = repo.upsert({ ...sample, discordId: 'u2' })
    expect(isErr(r)).toBe(true)
  })

  it('setRole updates only the role', () => {
    repo.upsert(sample)
    repo.setRole('g1', 'u1', 'duelist')
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) expect(f.value.role).toBe('duelist')
    else throw new Error('expected found')
  })

  it('remove deletes the player', () => {
    repo.upsert(sample)
    repo.remove('g1', 'u1')
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f)) expect(f.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('listByGuild returns all players in the guild', () => {
    repo.upsert(sample)
    repo.upsert({ ...sample, discordId: 'u2', puuid: 'pu-2' })
    const f = repo.listByGuild('g1')
    if (isOk(f)) expect(f.value).toHaveLength(2)
    else throw new Error('expected ok')
  })
})
