import { REST, Routes } from 'discord.js'
import { config } from 'dotenv'
import { allCommands } from '../src/adapters/discord/commands/index.js'
import { loadEnv } from '../src/config/env.js'
import { openDb } from '../src/adapters/sqlite/db.js'
import { SqliteTeamRepository } from '../src/adapters/sqlite/teamRepo.js'

config()
const env = loadEnv()
const db = openDb(env.DB_PATH)
const teamRepo = new SqliteTeamRepository(db)

const body = allCommands({ teamRepo }).map((c) => c.data.toJSON())
const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

const main = async () => {
  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body })
  console.log(`registered ${body.length} commands globally`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
