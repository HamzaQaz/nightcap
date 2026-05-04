import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteJobRepository } from './jobRepo.js'

describe('SqliteJobRepository', () => {
  let db: Db
  let repo: SqliteJobRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteJobRepository(db)
  })

  afterEach(() => db.close())

  it('enqueues and claims pending jobs', () => {
    const e = repo.enqueue('test_job', { x: 1 })
    if (!isOk(e)) throw new Error('enqueue failed')
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c) && c.value) {
      expect(c.value.kind).toBe('test_job')
      expect(c.value.status).toBe('running')
      expect(JSON.parse(c.value.payloadJson)).toEqual({ x: 1 })
    } else throw new Error('expected claimed job')
  })

  it('does not claim jobs whose run_at is in the future', () => {
    repo.enqueue('test_job', {}, Date.now() + 60_000)
    const c = repo.claimNext(Date.now())
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('markDone moves status to done', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markDone(e.value)
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('markFailed with nextRunAt re-queues for retry', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markFailed(e.value, 'boom', Date.now() + 100)
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c) && c.value) {
      expect(c.value.attempts).toBe(2)
      expect(c.value.lastError).toBe('boom')
    } else throw new Error('expected re-claimed')
  })

  it('markFailed with null nextRunAt sets status=failed', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markFailed(e.value, 'fatal', null)
    const c = repo.claimNext(Date.now() + 1_000_000)
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })
})
