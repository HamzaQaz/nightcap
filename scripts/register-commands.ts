import { REST, Routes } from 'discord.js'
import { config as loadDotenv } from 'dotenv'
import { allCommands } from '../src/adapters/discord/commands/index.js'
import { HenrikClient } from '../src/adapters/henrik/client.js'
import { openDb } from '../src/adapters/sqlite/db.js'
import { SqliteJobRepository } from '../src/adapters/sqlite/jobRepo.js'
import { SqliteMatchRepository } from '../src/adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from '../src/adapters/sqlite/playerRepo.js'
import { SqliteTeamRepository } from '../src/adapters/sqlite/teamRepo.js'
import { loadEnv } from '../src/config/env.js'

loadDotenv()
const env = loadEnv()
const db = openDb(env.DB_PATH)

const body = allCommands({
  teamRepo: new SqliteTeamRepository(db),
  playerRepo: new SqlitePlayerRepository(db),
  matchRepo: new SqliteMatchRepository(db),
  jobRepo: new SqliteJobRepository(db),
  provider: new HenrikClient({ apiKey: env.HENRIK_API_KEY }),
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
