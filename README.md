# premier-bot

Self-hosted Discord bot for managing a Valorant Premier team. See `docs/superpowers/specs/2026-05-03-premier-bot-design.md` for the full design.

## Quickstart (self-host)

1. Copy env template: `cp .env.example .env` and fill in:
   - `DISCORD_TOKEN`, `DISCORD_APP_ID` from https://discord.com/developers/applications
   - `GEMINI_API_KEY` from https://aistudio.google.com (only needed once Plan 2 ships)
   - `HENRIK_API_KEY` is optional but raises rate limits — apply at https://docs.henrikdev.xyz
2. Install + build: `pnpm install && pnpm build`
3. Register slash commands once: `pnpm register-commands`
4. Run: `pnpm start` (foreground) or install the systemd unit at `systemd/premier-bot.service`
5. In Discord, invite the bot with the `applications.commands` scope and `bot` scope (Send Messages, Create Public Threads, Read Message History)
6. As a server admin run `/team set` for `region`, `conference` (e.g. `NA_US_WEST`), `henrik-team-id`, `captain-role`, `member-role`, `channel`
7. Captain runs `/roster add @user RiotName#TAG <role>` for each player (or members run `/link`, then captain runs `/roster set-role`)

## Docker

```bash
docker build -t premier-bot .
docker run -d --name premier-bot --env-file .env -v $(pwd)/data:/app/data premier-bot
```
