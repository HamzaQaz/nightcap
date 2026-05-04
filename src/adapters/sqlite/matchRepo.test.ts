import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteMatchRepository } from './matchRepo.js'

const sample = {
  guildId: 'g1',
  matchId: 'm-1',
  seasonId: 's-1',
  playedAt: 1_700_000_000_000,
  map: 'Ascent',
  result: 'win' as const,
  scoreUs: 13,
  scoreThem: 7,
  rawJson: '{}',
  threadId: null,
}

describe('SqliteMatchRepository', () => {
  let db: Db
  let repo: SqliteMatchRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteMatchRepository(db)
  })

  afterEach(() => db.close())

  it('inserts and finds a match', () => {
    repo.insert(sample)
    const f = repo.findByMatchId('g1', 'm-1')
    if (isOk(f) && f.value) {
      expect(f.value.map).toBe('Ascent')
      expect(f.value.result).toBe('win')
    } else throw new Error('expected found')
  })

  it('setThreadId updates the thread id', () => {
    repo.insert(sample)
    repo.setThreadId('g1', 'm-1', 'thread-9')
    const f = repo.findByMatchId('g1', 'm-1')
    if (isOk(f) && f.value) expect(f.value.threadId).toBe('thread-9')
    else throw new Error('expected found')
  })

  it('listRecent returns matches newest first', () => {
    repo.insert({ ...sample, matchId: 'm-1', playedAt: 100 })
    repo.insert({ ...sample, matchId: 'm-2', playedAt: 200 })
    const f = repo.listRecent('g1', 5)
    if (isOk(f)) expect(f.value.map((m) => m.matchId)).toEqual(['m-2', 'm-1'])
    else throw new Error('expected ok')
  })
})
