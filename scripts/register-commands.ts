import { REST, Routes } from 'discord.js'
import { config as loadDotenv } from 'dotenv'
import { createDiscordClient } from '../src/adapters/discord/client.js'
import { allCommands } from '../src/adapters/discord/commands/index.js'
import { HenrikClient } from '../src/adapters/henrik/client.js'
import { openDb } from '../src/adapters/sqlite/db.js'
import { SqliteJobRepository } from '../src/adapters/sqlite/jobRepo.js'
import { SqliteMatchNightsRepository } from '../src/adapters/sqlite/matchNightsRepo.js'
import { SqliteMatchRepository } from '../src/adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from '../src/adapters/sqlite/playerRepo.js'
import { SqliteScrimsRepository } from '../src/adapters/sqlite/scrimsRepo.js'
import { SqliteTeamRepository } from '../src/adapters/sqlite/teamRepo.js'
import { SqliteVodNotesRepository, SqliteVodsRepository } from '../src/adapters/sqlite/vodRepos.js'
import { loadEnv } from '../src/config/env.js'

loadDotenv()
const env = loadEnv()
const db = openDb(env.DB_PATH)
const client = createDiscordClient()

const body = allCommands({
  teamRepo: new SqliteTeamRepository(db),
  playerRepo: new SqlitePlayerRepository(db),
  matchRepo: new SqliteMatchRepository(db),
  jobRepo: new SqliteJobRepository(db),
  matchNightsRepo: new SqliteMatchNightsRepository(db),
  scrimRepo: new SqliteScrimsRepository(db),
  vodsRepo: new SqliteVodsRepository(db),
  vodNotesRepo: new SqliteVodNotesRepository(db),
  provider: new HenrikClient({ apiKey: env.HENRIK_API_KEY }),
  client,
}).map((c) => c.data.toJSON())

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

const main = async () => {
  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body })
  console.log(`registered ${body.length} commands globally`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.close())
