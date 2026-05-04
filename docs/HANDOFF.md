# premier-bot — Session Handoff

**Last updated**: 2026-05-04
**Status**: All four plans (MVP + AI coaching + scheduling + VOD/stats) complete on `mvp-impl` branch. 131/131 tests pass, `pnpm tsc --noEmit` clean, `pnpm build` clean, `pnpm lint` clean (warnings only). Bot is runnable end-to-end after `.env` is populated and `pnpm register-commands` is run once.

---

## What ships now

### Slash commands

**Captain**
- `/team set <field> <value>` — region, conference, henrik-team-id, captain-role, member-role, channel
- `/team show`
- `/team match-nights add|remove|list <weekday> [preference-order]` — primary/fallback ladder
- `/roster add @user <RiotName#TAG> [role]`
- `/roster remove @user`
- `/roster set-role @user <role>`
- `/scrim cancel <id>`

**Member**
- `/link <RiotName#TAG>` (no role argument; captain assigns role)
- `/unlink`
- `/match latest` — re-ingest most recent
- `/match link <id-or-url>` — manual ingest
- `/match coach @player <match-id>` — re-run AI coaching for one player
- `/scrim propose <date> <time> [note]`
- `/scrim list`
- `/vod add <url> [match-id]` — creates/links a thread
- `/vod note <vod-id> <mm:ss> [@player] <text>`
- `/vod list`
- `/stats season` — W-L, ADR, HS%, top agents, map win-rate

**Anyone**
- `/help`

### Background jobs (in-memory queue, SQLite-backed)

| Job kind | Trigger | Behavior |
|---|---|---|
| `pollPremier` | cron `*/5 * * * *` per guild | Diff Henrik history → enqueue ingestMatch for new matches |
| `ingestMatch` | enqueued by pollPremier or `/match link` | Fetch detail → persist match → post embed + thread → enqueue per-player + team summarize jobs |
| `summarizeMatch` | enqueued by ingestMatch or `/match coach` | One Gemini call per player → persist → post public block in match thread → DM private block (50007 fallback to captain note) |
| `openMatchNightPoll` | cron `0 12 * * 1` UTC per guild | Open primary-night poll (or fallback when called with `preferenceOrder=2`) |
| `closeMatchNightPoll` | enqueued by `closeDueMatchNightPolls` | Quorum met → schedule T-60/T-10 reminders. Quorum failed → enqueue next preference, or post skip-week if no fallback |
| `closeDueMatchNightPolls` | cron `*/5 * * * *` global | Iterate `pollsRepo.listClosingBefore(now)` → enqueue closeMatchNightPoll per due poll |
| `sendReminder` | scheduled per quorum-met match-night | Pings member-role at T-60min and T-10min with map + match time |

Worker config: poll every 2s, max 3 concurrent jobs, exponential backoff (5s → 30s → 5m → 30m), 5 attempts then `failed`.

### Migrations applied
- `0001_init.sql` — teams, players, matches, jobs
- `0002_ai_summaries.sql` — ai_summaries (cached coaching output keyed by prompt_hash)
- `0003_scheduling.sql` — team_match_nights, scrims, rsvps, match_night_polls, poll_rsvps
- `0004_vods.sql` — vods, vod_notes

### Data flow highlights
- **Hexagonal**: every external dep is a port; `MatchDataProvider`, `AICoach`, `MatchAnnouncer`, `CoachingAnnouncer`, `ScheduleAnnouncer` are mockable in tests.
- **Result<T, DomainError>**: zero throws across use cases. Adapters convert exceptions at the boundary.
- **HenrikDev seasons cache**: 6h in-memory per `(region, conference)` key.
- **Gemini structured output**: `responseMimeType: application/json` + `responseSchema`. Output is zod-validated against `playerCoachingSchema` / `teamCoachingSchema`.
- **prompt_hash caching**: `/match coach` retries don't re-call Gemini if the prompt hash matches the stored summary.
- **DM-disabled fallback**: 50007 → log warn + post captain note in match thread + mark job done. Coaching JSON is still persisted.
- **Pre-role default**: if a player has `role=NULL` at coaching time, the prompt uses Flex criteria and the public block adds *"@player has no assigned role yet — captain, set one with /roster set-role"*.
- **Poll RSVPs**: button-driven (no extra Discord intent needed), customId pattern `mnpoll:{pollId}:yes|maybe|no`.
- **SAT→SUN→skip ladder**: defaults to SAT primary, SUN fallback when team has not configured `team_match_nights`. Captain can override per-guild.

---

## File map (current)

```
docs/
  HANDOFF.md                                           ← THIS FILE
  superpowers/
    specs/2026-05-03-premier-bot-design.md             ← authoritative spec
    plans/2026-05-03-premier-bot-mvp.md                ← Plan 1 (executed)
migrations/
  0001_init.sql, 0002_ai_summaries.sql,
  0003_scheduling.sql, 0004_vods.sql
prompts/
  role-criteria.md                                     ← role-involvement rubric
src/
  main.ts                                              ← composition root
  config/env.ts
  domain/{result.ts, errors.ts}
  app/
    setTeamConfig.ts, setPlayerRole.ts, linkPlayer.ts, ingestMatch.ts
    summarizeMatch.ts, coachingFormat.ts
    parseDateTime.ts, parseVodTimestamp.ts
    matchNightLadder.ts, openMatchNightPoll.ts, closeMatchNightPoll.ts, recordPollRsvp.ts
    seasonStats.ts
  ports/
    repositories.ts (Team, Player, Match, Job, AISummaries, MatchNights, Scrims, Rsvps,
                     MatchNightPolls, PollRsvps, Vods, VodNotes)
    matchData.ts (resolveAccount, listRecentMatches, getMatchDetail, getPremierSchedule)
    announcer.ts (MatchAnnouncer)
    coachingAnnouncer.ts (CoachingAnnouncer + DmFailure)
    scheduleAnnouncer.ts (ScheduleAnnouncer)
    aiCoach.ts (AICoach + PlayerCoaching/TeamCoaching schemas)
  adapters/
    sqlite/
      db.ts, migrator.ts, migrations.ts
      teamRepo.ts, playerRepo.ts, matchRepo.ts, jobRepo.ts
      aiSummariesRepo.ts, matchNightsRepo.ts, scrimsRepo.ts, rsvpsRepo.ts
      matchNightPollsRepo.ts, vodRepos.ts
    henrik/
      schemas.ts, schedule.ts, client.ts                ← getPremierSchedule + 6h cache
    gemini/
      schemas.ts, prompts.ts, client.ts                 ← GeminiCoach (gemini-2.5-flash)
    discord/
      client.ts, command.ts, permission.ts, registry.ts, router.ts
      announcer.ts (match thread)
      coachingAnnouncer.ts (thread + DM + captain note)
      scheduleAnnouncer.ts (poll embed + buttons + skip-week)
      embeds/matchEmbed.ts
      commands/
        index.ts, help.ts, team.ts, link.ts, roster.ts, match.ts
        scrim.ts, vod.ts, stats.ts
  jobs/
    worker.ts, jobKinds.ts
    pollPremier.ts, ingestMatch.ts, summarizeMatch.ts
    matchNightPoll.ts (open + close + closeDue), sendReminder.ts
  lib/
    logger.ts, http.ts
scripts/
  register-commands.ts
tests/
  smoke.test.ts, fixtures/henrik/{account,match-detail,seasons}.json
systemd/premier-bot.service
Dockerfile, README.md, .env.example
biome.json, package.json, pnpm-lock.yaml, tsconfig.json, vitest.config.ts
```

---

## Deploy checklist

1. Populate `.env` from `.env.example`:
   - `DISCORD_TOKEN`, `DISCORD_APP_ID` (mandatory)
   - `GEMINI_API_KEY` (mandatory — coaching layer fails fast at boot without it)
   - `HENRIK_API_KEY` (optional — raises rate limits)
   - `DB_PATH` defaults to `./data/premier.db`
2. `pnpm install --prod`
3. `pnpm build`
4. `pnpm register-commands` (one-shot, after every command-schema change)
5. `node --enable-source-maps dist/main.js` (or use `systemd/premier-bot.service`)

In Discord: invite the bot with `applications.commands` + `bot` scopes and these bot perms minimum: View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Read Message History, Embed Links, Use Application Commands.

---

## Important context

- **HenrikDev unofficial Valorant API** — primary data source. Optional `HENRIK_API_KEY` raises limits. 429 → exponential backoff (5s base, max 5 retries).
- **Gemini 2.5 Flash** via `@google/genai` 1.51 — structured output mode (JSON schema). Free tier from aistudio.google.com.
- **discord.js 14.26** — Guilds intent only (no MessageReactions or MessageContent). Buttons used for poll RSVPs to avoid the reaction intent.
- **node-cron 4.x** — cron expressions in UTC; `{ timezone: 'UTC' }` passed explicitly to the Monday-12:00 schedule.
- **biome 2.4.14** — config has `files.includes` excluding `dist/`, `data/`, `node_modules/`, `.omc/`, `coverage/`.
- **pnpm 10** requires `pnpm.onlyBuiltDependencies: ['better-sqlite3', 'esbuild']` in package.json so native bindings build.
- **`exactOptionalPropertyTypes: true`** in tsconfig — when a config field is optional, build the options object conditionally rather than passing `field: undefined`.
- **TDD discipline**: every use case has tests against mocked ports.

---

## What was deferred (from the design spec §13)

- Multi-team per Discord server
- Web dashboard
- Tournament bracket integration
- Twitch/YouTube live alerts
- Voice channel auto-create on confirmed scrim
- `.dem` file parsing
- Per-map heatmaps / round-by-round breakdowns
- Per-player opt-out for AI DMs (current workaround: Discord block on the bot)
- `/match-night force-confirm` (currently `❓` doesn't count toward quorum)
