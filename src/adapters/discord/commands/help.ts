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
        '__Team setup (captain)__\n' +
        '`/team set` — region, conference, roles, channel, henrik-team-id\n' +
        '`/team show`\n' +
        '`/team match-nights add|remove|list` — set primary/fallback match nights\n' +
        '__Roster__\n' +
        '`/link <RiotName#TAG>` (member self-service)\n' +
        '`/unlink`\n' +
        '`/roster add|remove|set-role` (captain)\n' +
        '__Matches__\n' +
        '`/match latest` — re-post the most recent match\n' +
        '`/match link <id-or-url>` — manually ingest\n' +
        '`/match coach @player <match-id>` — re-run AI coaching for a player\n' +
        '__Scheduling__\n' +
        '`/scrim propose <date> <time> [note]` — Date `YYYY-MM-DD`, time `HH:MM`\n' +
        '`/scrim list`, `/scrim cancel <id>` (captain)\n' +
        '__VOD review__\n' +
        '`/vod add <url> [match-id]`, `/vod note <vod-id> <mm:ss> [@player] <text>`, `/vod list`\n' +
        '__Stats__\n' +
        '`/stats season` — current Premier season W-L, ADR, HS%, top agents, map win-rate',
    })
  },
}
