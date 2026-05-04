import { describe, expect, it, vi } from 'vitest'
import { ok } from '../domain/result.js'
import type { JobRecord, JobRepository } from '../ports/repositories.js'
import { type JobHandler, runOnce } from './worker.js'

const makeRepo = (jobs: JobRecord[]): JobRepository => {
  let i = 0
  return {
    enqueue: vi.fn().mockReturnValue(ok(0)),
    claimNext: vi.fn().mockImplementation(() => ok(jobs[i++] ?? null)),
    markDone: vi.fn().mockReturnValue(ok(undefined)),
    markFailed: vi.fn().mockReturnValue(ok(undefined)),
  }
}

describe('runOnce', () => {
  it('dispatches jobs to handlers and marks done on success', async () => {
    const job: JobRecord = {
      id: 1,
      kind: 'echo',
      payloadJson: '{"x":1}',
      runAt: 0,
      attempts: 1,
      lastError: null,
      status: 'running',
    }
    const repo = makeRepo([job])
    const handler: JobHandler = vi.fn().mockResolvedValue(undefined)
    const handlers = new Map([['echo', handler]])
    await runOnce({ repo, handlers, maxJobs: 1, now: 100 })
    expect(handler).toHaveBeenCalledWith({ x: 1 })
    expect(repo.markDone).toHaveBeenCalledWith(1)
  })

  it('marks failed with backoff on handler throw, then sets failed after max attempts', async () => {
    const repo = makeRepo([
      {
        id: 2,
        kind: 'boom',
        payloadJson: '{}',
        runAt: 0,
        attempts: 1,
        lastError: null,
        status: 'running',
      },
    ])
    const handlers = new Map<string, JobHandler>([['boom', () => Promise.reject(new Error('x'))]])
    await runOnce({ repo, handlers, maxJobs: 1, now: 100, maxAttempts: 5 })
    expect(repo.markFailed).toHaveBeenCalledWith(2, 'x', expect.any(Number))

    const repo2 = makeRepo([
      {
        id: 3,
        kind: 'boom',
        payloadJson: '{}',
        runAt: 0,
        attempts: 5,
        lastError: 'x',
        status: 'running',
      },
    ])
    await runOnce({ repo: repo2, handlers, maxJobs: 1, now: 100, maxAttempts: 5 })
    expect(repo2.markFailed).toHaveBeenCalledWith(3, 'x', null)
  })

  it('logs and skips when handler kind is unknown', async () => {
    const repo = makeRepo([
      {
        id: 4,
        kind: 'unknown',
        payloadJson: '{}',
        runAt: 0,
        attempts: 1,
        lastError: null,
        status: 'running',
      },
    ])
    await runOnce({ repo, handlers: new Map(), maxJobs: 1, now: 100 })
    expect(repo.markFailed).toHaveBeenCalledWith(4, 'unknown handler: unknown', null)
  })
})
