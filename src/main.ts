import { config as loadDotenv } from 'dotenv'
import cron from 'node-cron'
import { DiscordMatchAnnouncer } from './adapters/discord/announcer.js'
import { createDiscordClient } from './adapters/discord/client.js'
import { DiscordCoachingAnnouncer } from './adapters/discord/coachingAnnouncer.js'
import { allCommands, type CommandDeps } from './adapters/discord/commands/index.js'
import { buildRegistry } from './adapters/discord/registry.js'
import { routeButton, routeInteraction } from './adapters/discord/router.js'
import { DiscordScheduleAnnouncer } from './adapters/discord/scheduleAnnouncer.js'
import { GeminiCoach } from './adapters/gemini/client.js'
import { HenrikClient } from './adapters/henrik/client.js'
import { SqliteAISummariesRepository } from './adapters/sqlite/aiSummariesRepo.js'
import { openDb } from './adapters/sqlite/db.js'
import { SqliteJobRepository } from './adapters/sqlite/jobRepo.js'
import {
  SqliteMatchNightPollsRepository,
  SqlitePollRsvpsRepository,
} from './adapters/sqlite/matchNightPollsRepo.js'
import { SqliteMatchNightsRepository } from './adapters/sqlite/matchNightsRepo.js'
import { SqliteMatchRepository } from './adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from './adapters/sqlite/playerRepo.js'
import { SqliteRsvpsRepository } from './adapters/sqlite/rsvpsRepo.js'
import { SqliteScrimsRepository } from './adapters/sqlite/scrimsRepo.js'
import { SqliteTeamRepository } from './adapters/sqlite/teamRepo.js'
import { SqliteVodNotesRepository, SqliteVodsRepository } from './adapters/sqlite/vodRepos.js'
import { loadEnv } from './config/env.js'
import { makeIngestMatchHandler } from './jobs/ingestMatch.js'
import {
  CLOSE_DUE_MATCH_NIGHT_POLLS_JOB,
  CLOSE_MATCH_NIGHT_POLL_JOB,
  INGEST_MATCH_JOB,
  OPEN_MATCH_NIGHT_POLL_JOB,
  POLL_PREMIER_JOB,
  SEND_REMINDER_JOB,
  SUMMARIZE_MATCH_JOB,
} from './jobs/jobKinds.js'
import {
  makeCloseDuePollsHandler,
  makeCloseMatchNightPollHandler,
  makeOpenMatchNightPollHandler,
} from './jobs/matchNightPoll.js'
import { makePollPremierHandler } from './jobs/pollPremier.js'
import { makeSendReminderHandler } from './jobs/sendReminder.js'
import { makeSummarizeMatchHandler } from './jobs/summarizeMatch.js'
import { startWorker } from './jobs/worker.js'
import { createLogger } from './lib/logger.js'

loadDotenv()
const env = loadEnv()
const logger = createLogger(env)

const db = openDb(env.DB_PATH)
const teamRepo = new SqliteTeamRepository(db)
const playerRepo = new SqlitePlayerRepository(db)
const matchRepo = new SqliteMatchRepository(db)
const jobRepo = new SqliteJobRepository(db)
const aiSummariesRepo = new SqliteAISummariesRepository(db)
const matchNightsRepo = new SqliteMatchNightsRepository(db)
const scrimRepo = new SqliteScrimsRepository(db)
const rsvpRepo = new SqliteRsvpsRepository(db)
const pollsRepo = new SqliteMatchNightPollsRepository(db)
const pollRsvpsRepo = new SqlitePollRsvpsRepository(db)
const vodsRepo = new SqliteVodsRepository(db)
const vodNotesRepo = new SqliteVodNotesRepository(db)
void rsvpRepo

const provider = new HenrikClient({ apiKey: env.HENRIK_API_KEY })
const coach = new GeminiCoach({ apiKey: env.GEMINI_API_KEY })

const client = createDiscordClient()
const matchAnnouncer = new DiscordMatchAnnouncer(client)
const coachingAnnouncer = new DiscordCoachingAnnouncer(client)
const scheduleAnnouncer = new DiscordScheduleAnnouncer(client)

const cmdDeps: CommandDeps = {
  teamRepo,
  playerRepo,
  matchRepo,
  jobRepo,
  matchNightsRepo,
  scrimRepo,
  vodsRepo,
  vodNotesRepo,
  provider,
  client,
}
const registry = buildRegistry(allCommands(cmdDeps))

const summarizeDeps = {
  teamRepo,
  matchRepo,
  playerRepo,
  aiSummariesRepo,
  coach,
  announcer: coachingAnnouncer,
  logger,
}

const handlers = new Map([
  [POLL_PREMIER_JOB, makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })],
  [
    INGEST_MATCH_JOB,
    makeIngestMatchHandler({
      teamRepo,
      matchRepo,
      playerRepo,
      provider,
      announcer: matchAnnouncer,
      jobRepo,
    }),
  ],
  [SUMMARIZE_MATCH_JOB, makeSummarizeMatchHandler(summarizeDeps)],
  [
    OPEN_MATCH_NIGHT_POLL_JOB,
    makeOpenMatchNightPollHandler({
      teamRepo,
      matchNightsRepo,
      pollsRepo,
      provider,
      announcer: scheduleAnnouncer,
    }),
  ],
  [
    CLOSE_MATCH_NIGHT_POLL_JOB,
    makeCloseMatchNightPollHandler({
      teamRepo,
      pollsRepo,
      rsvpsRepo: pollRsvpsRepo,
      matchNightsRepo,
      jobRepo,
      announcer: scheduleAnnouncer,
    }),
  ],
  [CLOSE_DUE_MATCH_NIGHT_POLLS_JOB, makeCloseDuePollsHandler({ pollsRepo, jobRepo })],
  [SEND_REMINDER_JOB, makeSendReminderHandler({ announcer: scheduleAnnouncer })],
])

client.on('interactionCreate', async (i) => {
  if (i.isChatInputCommand()) {
    await routeInteraction(i, { registry, teamRepo, ctx: { logger } })
    return
  }
  if (i.isButton()) {
    await routeButton(i, {
      rsvpDeps: {
        teamRepo,
        pollsRepo,
        rsvpsRepo: pollRsvpsRepo,
        announcer: scheduleAnnouncer,
      },
      ctx: { logger },
    })
    return
  }
})

client.once('ready', () => {
  logger.info({ user: client.user?.tag }, 'discord client ready')
})

const ac = new AbortController()
const stop = () => {
  logger.info('shutting down')
  ac.abort()
  client.destroy().catch(() => {})
  db.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

await client.login(env.DISCORD_TOKEN)

cron.schedule('*/5 * * * *', () => {
  for (const guildId of client.guilds.cache.keys()) {
    jobRepo.enqueue(POLL_PREMIER_JOB, { guildId })
  }
  jobRepo.enqueue(CLOSE_DUE_MATCH_NIGHT_POLLS_JOB, {})
})

cron.schedule(
  '0 12 * * 1',
  () => {
    for (const guildId of client.guilds.cache.keys()) {
      jobRepo.enqueue(OPEN_MATCH_NIGHT_POLL_JOB, { guildId, preferenceOrder: 1 })
    }
  },
  { timezone: 'UTC' },
)

void startWorker({ repo: jobRepo, handlers, maxJobs: 3, signal: ac.signal })
