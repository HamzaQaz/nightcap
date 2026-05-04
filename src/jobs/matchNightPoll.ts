import { closeMatchNightPoll, type CloseMatchNightPollDeps } from '../app/closeMatchNightPoll.js'
import { openMatchNightPoll, type OpenMatchNightPollDeps } from '../app/openMatchNightPoll.js'
import { isErr } from '../domain/result.js'
import type {
  JobRepository,
  MatchNightPollsRepository,
} from '../ports/repositories.js'
import { CLOSE_MATCH_NIGHT_POLL_JOB } from './jobKinds.js'
import type { JobHandler } from './worker.js'

export type OpenPollPayload = { guildId: string; preferenceOrder: number }

export const makeOpenMatchNightPollHandler =
  (deps: OpenMatchNightPollDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as OpenPollPayload
    const r = await openMatchNightPoll(deps, payload)
    if (isErr(r)) throw new Error(`openMatchNightPoll failed: ${r.error.tag}`)
  }

export type ClosePollPayload = { pollId: number }

export const makeCloseMatchNightPollHandler =
  (deps: CloseMatchNightPollDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as ClosePollPayload
    const r = await closeMatchNightPoll(deps, payload.pollId)
    if (isErr(r)) throw new Error(`closeMatchNightPoll failed: ${r.error.tag}`)
  }

export type CloseDueDeps = {
  pollsRepo: MatchNightPollsRepository
  jobRepo: JobRepository
  now?: () => number
}

export const makeCloseDuePollsHandler =
  (deps: CloseDueDeps): JobHandler =>
  async () => {
    const due = deps.pollsRepo.listClosingBefore((deps.now ?? Date.now)())
    if (isErr(due)) throw new Error(`listClosingBefore failed: ${due.error.tag}`)
    for (const poll of due.value) {
      deps.jobRepo.enqueue(CLOSE_MATCH_NIGHT_POLL_JOB, { pollId: poll.id })
    }
  }
