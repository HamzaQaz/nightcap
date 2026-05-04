# nightcap

> An always-on Discord teammate for your Valorant Premier squad. Posts your match results, writes you AI coaching after every game, runs the weekly match-night poll on autopilot, and keeps a VOD library with timestamped notes.

Built for self-hosting on a single box. One Discord server = one team.

---

## What it does

- **Auto-ingests Premier matches** — polls HenrikDev every 5 min, posts a stats embed in your announcements channel, opens a thread per match.
- **AI coaching via Gemini 2.5 Flash** — after each match every player gets a public summary in the thread (highlight + focus area + role-involvement %) and a **private DM** with candid feedback (1-3 things you did well, 1-3 to improve, role-specific tip, evidence-based scoring).
- **Weekly match-night poll** — Monday opens the primary-night poll with map info from Riot's schedule. 5 ✅ quorum locks the night and schedules T-60min and T-10min reminder pings. Quorum fails → opens fallback-night poll. Both fail → "skip this week" message. SAT primary / SUN fallback by default; reconfigurable per team.
- **Scrim scheduling** — `/scrim propose` with date/time/note, button RSVPs, captain can cancel.
- **VOD library** — `/vod add <url>` opens a thread; `/vod note 5 4:32 @player ...` drops timestamped review notes.
- **Season stats** — `/stats season` shows W-L, per-map win-rate, per-player ADR / HS% / top agents.

For a full plain-English walkthrough of every feature, see [`docs/WHAT-IT-DOES.md`](docs/WHAT-IT-DOES.md).

---

## Quickstart (self-host)

```bash
# 1. clone + install
git clone https://github.com/HamzaQaz/nightcap.git
cd nightcap
pnpm install

# 2. env
cp .env.example .env
# fill in DISCORD_TOKEN, DISCORD_APP_ID, GEMINI_API_KEY (HENRIK_API_KEY optional)

# 3. build + register slash commands once
pnpm build
pnpm register-commands

# 4. run (foreground)
pnpm start
# or use systemd/nightcap.service for production
```

In Discord, invite the bot with **`applications.commands`** + **`bot`** scopes and these permissions: View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Read Message History, Embed Links, Use Application Commands.

Then in your server, an admin runs:

```
/team set field:region                  string-value:na
/team set field:conference               string-value:NA_US_WEST
/team set field:henrik-team-id           string-value:<your-premier-team-id>
/team set field:captain-role             role-value:@Captain
/team set field:member-role              role-value:@Player
/team set field:channel                  channel-value:#premier-announcements
```

Each player runs `/link <RiotName#TAG>`, then the captain runs `/roster set-role @user controller` (or `/roster add` for someone who hasn't `/link`ed yet).

That's it. Keep the bot running and it does the rest.

---

## Docker

```bash
docker build -t nightcap .
docker run -d --name nightcap --env-file .env -v "$(pwd)/data:/app/data" nightcap
```

The SQLite database lives in `./data/premier.db` so you can back up the volume.

---

## Required env vars

| Var | Required | Notes |
|---|---|---|
| `DISCORD_TOKEN` | yes | https://discord.com/developers/applications |
| `DISCORD_APP_ID` | yes | from the same app |
| `GEMINI_API_KEY` | yes | https://aistudio.google.com — free tier works |
| `HENRIK_API_KEY` | no | optional, raises rate limits — https://docs.henrikdev.xyz |
| `DB_PATH` | no | default `./data/premier.db` |
| `LOG_LEVEL` | no | `trace`/`debug`/`info`/`warn`/`error` (default `info`) |
| `NODE_ENV` | no | default `production` |

---

## Tech stack

- **Runtime**: Node 22 LTS, TypeScript strict, ESM
- **Discord**: discord.js 14 (Guilds intent only — buttons handle poll RSVPs so no privileged intents needed)
- **DB**: better-sqlite3 (WAL), idempotent SQL migrations applied on boot
- **Validation**: zod everywhere — env, command inputs, API responses
- **AI**: `@google/genai` (Gemini 2.5 Flash, structured output mode)
- **Scheduler**: node-cron + in-memory job queue backed by a SQLite `jobs` table (crash-safe, exponential backoff)
- **Architecture**: hexagonal (ports & adapters), `Result<T, DomainError>` instead of throws, TDD across 35 test files
- **Tests**: vitest (131 passing), mocked ports, recorded HenrikDev fixtures, in-memory SQLite for repo tests
- **Lint/format**: biome
- **Package manager**: pnpm 10

---

## Commands cheat sheet

**Captain**
- `/team set <field> <value>` · `/team show`
- `/team match-nights add|remove|list <weekday> [preference-order]`
- `/roster add|remove|set-role @user ...`
- `/scrim cancel <id>`

**Member**
- `/link <RiotName#TAG>` · `/unlink`
- `/match latest` · `/match link <id-or-url>` · `/match coach @player <match-id>`
- `/scrim propose <date> <time> [note]` · `/scrim list`
- `/vod add <url> [match-id]` · `/vod note <vod-id> <mm:ss> [@player] <text>` · `/vod list`
- `/stats season`

**Anyone**
- `/help`

---

## Project structure

```
src/
  main.ts                            # composition root
  config/env.ts                      # zod-validated env loader
  domain/                            # Result + DomainError
  app/                               # use cases (pure, mockable)
  ports/                             # interfaces the domain depends on
  adapters/
    sqlite/                          # repos
    henrik/                          # MatchDataProvider impl
    gemini/                          # AICoach impl
    discord/                         # commands, router, announcers
  jobs/                              # in-memory worker + handlers
  lib/                               # logger, http
migrations/                          # 0001-0004, applied on boot
prompts/role-criteria.md             # role-involvement scoring rubric
docs/
  WHAT-IT-DOES.md                    # plain-English feature tour
  HANDOFF.md                         # session handoff for contributors
  superpowers/specs/...              # design spec
tests/                               # smoke + Henrik fixtures
```

---

## License

**[PolyForm Noncommercial 1.0.0](LICENSE).**

You can use, modify, and redistribute nightcap for **noncommercial purposes** — personal teams, hobby projects, research, education, charitable orgs. **Commercial use is not permitted** without a separate license. See [`LICENSE`](LICENSE) for full terms.

If you want a commercial license, open an issue and we'll talk.

---

## Status

v1 ships all four feature plans (MVP / AI coaching / scheduling / VOD + stats). 131 tests passing, build clean. Active development continues in `mvp-impl` and merges to `main`.

Issues and PRs welcome.
