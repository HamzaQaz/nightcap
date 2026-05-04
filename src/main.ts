import { config as loadDotenv } from 'dotenv'
import cron from 'node-cron'
import { DiscordMatchAnnouncer } from './adapters/discord/announcer.js'
import { createDiscordClient } from './adapters/discord/client.js'
import { allCommands, type CommandDeps } from './adapters/discord/commands/index.js'
import { buildRegistry } from './adapters/discord/registry.js'
import { routeInteraction } from './adapters/discord/router.js'
import { HenrikClient } from './adapters/henrik/client.js'
import { openDb } from './adapters/sqlite/db.js'
import { SqliteJobRepository } from './adapters/sqlite/jobRepo.js'
import { SqliteMatchRepository } from './adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from './adapters/sqlite/playerRepo.js'
import { SqliteTeamRepository } from './adapters/sqlite/teamRepo.js'
import { loadEnv } from './config/env.js'
import { makeIngestMatchHandler } from './jobs/ingestMatch.js'
import { makePollPremierHandler } from './jobs/pollPremier.js'
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
const provider = new HenrikClient({ apiKey: env.HENRIK_API_KEY })

const client = createDiscordClient()
const announcer = new DiscordMatchAnnouncer(client)

const cmdDeps: CommandDeps = { teamRepo, playerRepo, matchRepo, jobRepo, provider }
const registry = buildRegistry(allCommands(cmdDeps))

const handlers = new Map([
  ['pollPremier', makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })],
  [
    'ingestMatch',
    makeIngestMatchHandler({ teamRepo, matchRepo, playerRepo, provider, announcer, jobRepo }),
  ],
])

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return
  await routeInteraction(i, { registry, teamRepo, ctx: { logger } })
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
    jobRepo.enqueue('pollPremier', { guildId })
  }
})

void startWorker({ repo: jobRepo, handlers, maxJobs: 3, signal: ac.signal })
