import { SlashCommandBuilder } from 'discord.js'
import type { SlashCommand } from '../command.js'

export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available premier-bot commands.'),
  permission: 'anyone',
  execute: async (interaction) => {
    await interaction.reply({
      ephemeral: true,
      content:
        '**premier-bot commands**\n' +
        '`/team set` — captain configures region, roles, channel, henrik team id\n' +
        '`/team show` — show current team config\n' +
        '`/link <RiotName#TAG>` — link your Riot account (member only)\n' +
        '`/unlink` — unlink your account\n' +
        '`/roster add @user RiotName#TAG [role]` — captain-only\n' +
        '`/roster remove @user` — captain-only\n' +
        '`/roster set-role @user <role>` — captain-only\n' +
        '`/match latest` — re-pull and post the most recent match\n' +
        '`/match link <id-or-url>` — manually ingest a match (e.g., a scrim)',
    })
  },
}
