import type { JobRepository } from '../ports/repositories.js'

export type JobHandler = (payload: unknown) => Promise<void>

export type RunOnceOpts = {
  repo: JobRepository
  handlers: Map<string, JobHandler>
  maxJobs: number
  now: number
  maxAttempts?: number
  baseBackoffMs?: number
}

const BACKOFF_MS = [5_000, 30_000, 300_000, 1_800_000]

export const runOnce = async (opts: RunOnceOpts): Promise<number> => {
  const max = opts.maxAttempts ?? 5
  let processed = 0
  for (let i = 0; i < opts.maxJobs; i++) {
    const claim = opts.repo.claimNext(opts.now)
    if (claim._tag === 'err' || claim.value === null) return processed
    const job = claim.value
    const handler = opts.handlers.get(job.kind)
    if (!handler) {
      opts.repo.markFailed(job.id, `unknown handler: ${job.kind}`, null)
      processed++
      continue
    }
    try {
      const payload = JSON.parse(job.payloadJson) as unknown
      await handler(payload)
      opts.repo.markDone(job.id)
    } catch (e) {
      const message = (e as Error).message
      if (job.attempts >= max) {
        opts.repo.markFailed(job.id, message, null)
      } else {
        const backoff = BACKOFF_MS[job.attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 60_000
        opts.repo.markFailed(job.id, message, opts.now + backoff)
      }
    }
    processed++
  }
  return processed
}

export type StartWorkerOpts = Omit<RunOnceOpts, 'now'> & {
  pollIntervalMs?: number
  signal: AbortSignal
}

export const startWorker = async (opts: StartWorkerOpts): Promise<void> => {
  const interval = opts.pollIntervalMs ?? 2_000
  while (!opts.signal.aborted) {
    await runOnce({ ...opts, now: Date.now() })
    await new Promise((r) => setTimeout(r, interval))
  }
}
