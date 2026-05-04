import { describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { SqliteAISummariesRepository } from './aiSummariesRepo.js'
import { openDb } from './db.js'

const newRepo = () => new SqliteAISummariesRepository(openDb(':memory:'))

const rec = (overrides: Partial<Parameters<SqliteAISummariesRepository['upsert']>[0]> = {}) => ({
  guildId: 'g1',
  matchId: 'm1',
  playerPuuid: 'p1',
  model: 'gemini-2.5-flash',
  promptHash: 'h1',
  output: '{"public":{}}',
  createdAt: 1000,
  ...overrides,
})

describe('SqliteAISummariesRepository', () => {
  it('upserts and finds', () => {
    const repo = newRepo()
    expect(isOk(repo.upsert(rec()))).toBe(true)
    const found = repo.find('g1', 'm1', 'p1')
    expect(isOk(found)).toBe(true)
    if (isOk(found)) {
      expect(found.value?.output).toBe('{"public":{}}')
      expect(found.value?.promptHash).toBe('h1')
    }
  })

  it('returns null when not found', () => {
    const repo = newRepo()
    const found = repo.find('g1', 'no', 'no')
    expect(isOk(found)).toBe(true)
    if (isOk(found)) expect(found.value).toBeNull()
  })

  it('overwrites on conflict', () => {
    const repo = newRepo()
    repo.upsert(rec({ output: 'first', promptHash: 'h1' }))
    repo.upsert(rec({ output: 'second', promptHash: 'h2', createdAt: 2000 }))
    const found = repo.find('g1', 'm1', 'p1')
    if (isOk(found) && found.value) {
      expect(found.value.output).toBe('second')
      expect(found.value.promptHash).toBe('h2')
      expect(found.value.createdAt).toBe(2000)
    }
  })

  it('isolates rows per (guild, match, player)', () => {
    const repo = newRepo()
    repo.upsert(rec({ playerPuuid: 'p1', output: 'A' }))
    repo.upsert(rec({ playerPuuid: 'p2', output: 'B' }))
    repo.upsert(rec({ matchId: 'm2', output: 'C' }))
    const a = repo.find('g1', 'm1', 'p1')
    const b = repo.find('g1', 'm1', 'p2')
    const c = repo.find('g1', 'm2', 'p1')
    if (isOk(a) && isOk(b) && isOk(c)) {
      expect(a.value?.output).toBe('A')
      expect(b.value?.output).toBe('B')
      expect(c.value?.output).toBe('C')
    }
  })
})
