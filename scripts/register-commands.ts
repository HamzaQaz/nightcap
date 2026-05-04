import { REST, Routes } from 'discord.js'
import { config } from 'dotenv'
import { loadEnv } from '../src/config/env.js'
import { allCommands } from '../src/adapters/discord/commands/index.js'

config()
const env = loadEnv()
const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

const body = allCommands().map((c) => c.data.toJSON())

const main = async () => {
  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body })
  console.log(`registered ${body.length} commands globally`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
