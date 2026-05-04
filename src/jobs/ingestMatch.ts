import { type IngestMatchDeps, ingestMatch } from '../app/ingestMatch.js'
import { isErr } from '../domain/result.js'
import type { JobHandler } from './worker.js'

export type IngestMatchJobPayload = { guildId: string; matchId: string }

export const makeIngestMatchHandler =
  (deps: IngestMatchDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as IngestMatchJobPayload
    const r = await ingestMatch(deps, payload)
    if (isErr(r)) throw new Error(`ingestMatch failed: ${r.error.tag}`)
  }
