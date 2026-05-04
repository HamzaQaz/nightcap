import { Client, GatewayIntentBits, Partials } from 'discord.js'

export const createDiscordClient = (): Client =>
  new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  })
