import { REST, Routes } from 'discord.js'
import { config } from 'dotenv'
import { HenrikClient } from '../src/adapters/henrik/client.js'
import { allCommands } from '../src/adapters/discord/commands/index.js'
import { SqlitePlayerRepository } from '../src/adapters/sqlite/playerRepo.js'
import { loadEnv } from '../src/config/env.js'
import { openDb } from '../src/adapters/sqlite/db.js'
import { SqliteTeamRepository } from '../src/adapters/sqlite/teamRepo.js'

config()
const env = loadEnv()
const db = openDb(env.DB_PATH)
const teamRepo = new SqliteTeamRepository(db)
const playerRepo = new SqlitePlayerRepository(db)
const provider = new HenrikClient({ apiKey: env.HENRIK_API_KEY })

const body = allCommands({ teamRepo, playerRepo, provider }).map((c) => c.data.toJSON())
const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

const main = async () => {
  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body })
  console.log(`registered ${body.length} commands globally`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
