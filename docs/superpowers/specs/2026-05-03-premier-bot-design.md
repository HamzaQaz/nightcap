# premier-bot — Design Spec

**Date**: 2026-05-03
**Status**: Approved (brainstorm), pending implementation plan
**Owner**: n1ght

## 1. Purpose

A self-hosted Discord bot that manages a single Valorant Premier team per Discord server. It owns the team's roster, schedules scrims, sends Premier match reminders, ingests post-match data via the HenrikDev unofficial Valorant API, and produces per-player AI coaching summaries via Google Gemini 2.5 Flash. A lightweight VOD review workflow ties recorded games back to specific players and timestamps.

The bot is multi-guild (one Discord server = one team), but a single instance can serve many guilds without code changes.

## 2. Goals and non-goals

**Goals**
- Single self-hosted Node process; trivial to deploy via systemd
- Persistent SQLite state, crash-safe job queue, no external infra dependencies
- All third-party I/O (Discord, Henrik, Gemini) behind ports so each is mockable in tests
- Slash-commands-only UX (no message-content intent)
- AI coaching is per-player and role-aware

**Non-goals (v1)**
- Multi-team per Discord server
- Web dashboard
- Tournament bracket integration
- Twitch/YouTube live alerts
- Voice channel auto-create
- Demo file analysis
- Per-map heatmaps or round-by-round breakdowns

## 3. Stack

| Layer | Choice |
|---|---|
| Runtime | Node 22 LTS |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) |
| Discord SDK | `discord.js` v14, intents: `Guilds` only |
| HTTP | native `fetch` + `undici` retry/timeout wrapper |
| DB | `better-sqlite3` (WAL mode), `./data/premier.db` |
| Migrations | hand-rolled SQL files in `migrations/`, applied on boot |
| Validation | `zod` at every boundary (env, command inputs, API responses) |
| Logger | `pino` + pretty transport in dev |
| Scheduler | `node-cron` for match-detection windows |
| AI | `@google/genai` (Gemini 2.5 Flash) |
| Tests | `vitest`, mock-first (TDD London) |
| Lint/format | `biome` |
| Package manager | `pnpm` |
| Build | `tsc` to `dist/`, run with `node --enable-source-maps dist/main.js` |
| Dev | `tsx` watch mode |

## 4. Architecture

Hexagonal (ports & adapters). Domain and use cases are pure; all I/O lives behind ports.

The process is a **single Node process with an in-memory job queue backed by SQLite-persisted state** (option 3 from the brainstorm). Discord gateway stays responsive because long-running work (Henrik fetches, Gemini calls) is enqueued, not awaited inline.

### 4.1 Project layout

```
premier-bot/
├── src/
│   ├── main.ts                    # composition root
│   ├── config/env.ts              # zod-validated env
│   ├── domain/
│   │   ├── team.ts                # Team, Player, Match, Scrim, Vod entities
│   │   ├── result.ts              # Result<T,E> + helpers
│   │   └── errors.ts              # tagged domain errors
│   ├── app/                       # use cases (pure, no I/O)
│   │   ├── linkPlayer.ts
│   │   ├── proposeScrim.ts
│   │   ├── recordRsvp.ts
│   │   ├── ingestMatch.ts
│   │   ├── summarizeMatch.ts
│   │   └── ...
│   ├── adapters/
│   │   ├── discord/               # commands, interactions, formatters
│   │   │   ├── commands/          # one file per slash command
│   │   │   ├── interactions/      # button + modal handlers
│   │   │   └── embeds/            # discord.js embed builders
│   │   ├── henrik/                # HenrikDev client + zod schemas
│   │   ├── gemini/                # AI coach client
│   │   └── sqlite/                # repositories implementing domain ports
│   ├── jobs/                      # in-memory queue + workers
│   │   ├── queue.ts
│   │   ├── pollPremier.ts
│   │   ├── summarizeMatchJob.ts
│   │   └── sendReminderJob.ts
│   └── ports/                     # interfaces the domain depends on
│       ├── MatchDataProvider.ts
│       ├── AICoach.ts
│       └── repositories.ts
├── migrations/0001_init.sql
├── tests/
├── data/                          # sqlite file (gitignored)
├── biome.json, tsconfig.json, package.json
```

File-size budget: 200–400 lines typical, 800 hard ceiling. One responsibility per file.

### 4.2 Error handling

Railway-Oriented: every use case returns `Result<T, DomainError>`. Adapters convert thrown exceptions and HTTP errors into tagged `DomainError` variants at the boundary. The Discord layer maps domain errors to user-facing ephemeral messages.

### 4.3 Concurrency

- Discord interaction handlers always acknowledge within 3s (use `deferReply` for any path that touches the DB or external APIs)
- Job worker loop polls the `jobs` table every 2s, runs up to 3 jobs concurrently
- `better-sqlite3` is synchronous; long transactions are not allowed inside the interaction hot path

## 5. Data model

```sql
CREATE TABLE teams (
  guild_id TEXT PRIMARY KEY,
  henrik_team_id TEXT,
  region TEXT,                      -- na|eu|ap|kr|latam|br
  captain_role_id TEXT,
  member_role_id TEXT,
  announcements_channel_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE players (
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  riot_name TEXT NOT NULL,
  riot_tag TEXT NOT NULL,
  puuid TEXT NOT NULL,
  role TEXT,                        -- duelist|initiator|controller|sentinel|flex
  added_by TEXT NOT NULL,           -- discord_id of captain or 'self'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, discord_id)
);
CREATE UNIQUE INDEX players_puuid_per_guild ON players (guild_id, puuid);

CREATE TABLE matches (
  guild_id TEXT NOT NULL,
  match_id TEXT NOT NULL,           -- henrik match id
  season_id TEXT,                   -- riot season/act id from match payload, used by /stats season
  played_at INTEGER NOT NULL,
  map TEXT,
  result TEXT,                      -- win|loss|draw|no_result (forfeit / no-show)
  score_us INTEGER,
  score_them INTEGER,
  raw_json TEXT NOT NULL,           -- full payload for re-rendering
  thread_id TEXT,                   -- discord thread for this match
  PRIMARY KEY (guild_id, match_id)
);
CREATE INDEX matches_season ON matches (guild_id, season_id);

CREATE TABLE scrims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  status TEXT NOT NULL,             -- proposed|confirmed|cancelled|past
  message_id TEXT,                  -- poll message
  created_at INTEGER NOT NULL
);

CREATE TABLE rsvps (
  scrim_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  status TEXT NOT NULL,             -- yes|no|maybe
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scrim_id, discord_id)
);

CREATE TABLE vods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  match_id TEXT,                    -- nullable (scrim or uncategorized)
  url TEXT NOT NULL,
  thread_id TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE vod_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vod_id INTEGER NOT NULL,
  timestamp_seconds INTEGER NOT NULL,
  target_discord_id TEXT,           -- nullable (general note)
  author_discord_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE jobs (                 -- persistent queue
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL              -- pending|running|done|failed
);

CREATE TABLE ai_summaries (
  match_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  player_puuid TEXT NOT NULL,       -- 'team' for team-level summary
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, match_id, player_puuid)
);
```

## 6. External integrations

### 6.1 HenrikDev (`MatchDataProvider` port)

- `getPremierTeam(teamId): Result<PremierTeam, ProviderError>`
- `listRecentMatches(teamId): Result<MatchSummary[], ProviderError>`
- `getMatchDetail(region, matchId): Result<MatchDetail, ProviderError>`
- `resolveAccount(name, tag): Result<{ puuid, region }, ProviderError>` (used by `/link`)

Every response is parsed by a zod schema. 429 responses trigger exponential backoff (5s base, max 5 retries). Optional `HENRIK_API_KEY` raises rate limits.

### 6.2 Gemini (`AICoach` port)

- `summarizeMatchForPlayer(match, puuid, role): Result<PlayerCoaching, AIError>`
- `summarizeMatchForTeam(match): Result<TeamCoaching, AIError>`

Prompts versioned in `prompts/` files; `prompt_hash` stored in `ai_summaries` so we can detect prompt changes and re-run on demand. Structured output via `responseSchema` (JSON mode).

Each player call returns **two blocks** in a single Gemini request — `public` (posted in the match thread, team-visible, blameless framing) and `private` (DM'd to that player only, candid and direct):

```ts
type PlayerCoaching = {
  public: {
    tldr: string                       // <= 160 chars, team-safe framing
    highlight: string                  // one positive moment worth calling out
    focus_area: string                 // one improvement area, blameless wording
    role_involvement_pct: number       // 0-100, how much the player fulfilled their assigned role
    role_involvement_one_liner: string // <= 100 chars rationale for the pct
  }
  private: {
    tldr: string                       // <= 200 chars, candid
    did_well: string[]                 // 1-3 items
    improve: string[]                  // 1-3 items, specific and direct
    coaching_tip: string               // role-specific actionable next-game advice
    role_involvement: {
      pct: number                      // matches the public pct
      criteria: Array<{
        name: string                   // e.g., "Entry attempts", "Site holds", "Util on retake"
        score_pct: number              // 0-100
        evidence: string               // <= 140 chars, what in the match data led to this
      }>
    }
  }
}

type TeamCoaching = {
  tldr: string                 // posted in match thread, public
  what_worked: string[]
  what_to_fix: string[]
  next_match_focus: string
}
```

A single Gemini call per player produces both blocks (cheaper, more consistent tone across the two outputs). The full `PlayerCoaching` JSON is persisted in `ai_summaries.output`; the dispatcher decides where each block goes.

**Role-involvement scoring rubric** (passed in the prompt so the model has consistent criteria across matches):

| Role | Criteria the model scores 0-100 on |
|---|---|
| Duelist | entry attempts, opening duels won, space taken, util used to enable team |
| Initiator | recon util landed, flashes that led to kills/trades, info called for, post-plant setups |
| Controller | smokes placed at executable timings, mid control util, retake smokes, utility economy |
| Sentinel | site anchor presence, flank watches, util held in reserve, retake util |
| Flex | weighted average of the above, scoped to the agent actually played that map |

Role criteria are kept in `prompts/role-criteria.md` so they can be tuned without code changes. The final `role_involvement_pct` is the model's weighted aggregate of the per-criterion scores; per-criterion scores + evidence go into the private block so the player can see *why*.

## 7. Slash command surface (v1)

**Captain-role**
- `/team set region|captain-role|member-role|channel|henrik-team-id <value>`
- `/team show`
- `/roster add @user <RiotName#TAG> [role]`
- `/roster remove @user`
- `/roster set-role @user <role>`
- `/scrim cancel <id>`

**Member-role** (and self-service)
- `/link <RiotName#TAG>` — verifies via Henrik `/account`, stores puuid. **Does not accept a role argument** — role stays `NULL` until a captain assigns it via `/roster set-role` (see §9). The bot replies with an ephemeral note telling the player their captain still needs to assign their in-game role.
- `/unlink`
- `/scrim propose <date> <time> [note]`
- `/match latest` — re-pulls and re-posts the most recent match
- `/match link <url-or-id>` — manual ingest (scrims, missed polls)
- `/match coach @player <match-id>` — re-runs AI for one player
- `/vod add <url> [match-id]`
- `/vod note <vod-id> <mm:ss> [@player] <text>`
- `/stats season` — team stats over the current Premier season. Season boundary is taken from the `season_id` field on the most recent ingested match; matches whose `season_id` differs are excluded. Reports W-L, avg ADR, avg HS%, top agent picks per player, map win-rate.

**Anyone**
- `/help`

## 8. Background jobs

| Job | Trigger | Behavior |
|---|---|---|
| `pollPremier` | `node-cron`: every 5 min Wed/Thu/Sun 8pm–1am region-local; every 30 min otherwise | Fetch team's recent matches, diff against `matches` table, enqueue `ingestMatch` for each new one |
| `ingestMatch` | enqueued by `pollPremier` or `/match link` | Pulls full match detail, persists `matches` row, opens a thread in announcements channel with stats embed, enqueues per-player and team-level `summarizeMatch` jobs |
| `summarizeMatch` | enqueued by `ingestMatch` or `/match coach` | Calls Gemini once per player; persists full `PlayerCoaching` to `ai_summaries`; posts the `public` block in the match thread with player @mention; DMs the player the `private` block. Team-level summary is posted in the thread (no DM). See §8.1 for the DM-disabled fallback. |
| `sendReminder` | scheduled per scrim/Premier match | Pings `member-role` with map/time at T-60min and T-10min |

Queue config: poll every 2s, max 3 concurrent jobs, exponential backoff (5s → 30s → 5m → 30m), max 5 attempts then `status='failed'` (manual replay only).

### 8.1 Public/private coaching delivery

Each player gets two AI outputs per match (see §6.2 `PlayerCoaching`):

1. **Public block** → posted as a reply in the match thread, prefixed with the player's @mention. Visible to the whole team. Blameless, focused on a highlight + one focus area.
2. **Private block** → DM'd to the player. Candid, multiple `did_well` / `improve` items, role-specific coaching tip.

**DM-disabled fallback**: if `User.send()` throws `DiscordAPIError[50007]` (Cannot send messages to this user), the job:
- logs at `warn` level with `discord_id` and `match_id`
- posts a single ephemeral note to the captain in the match thread: *"Couldn't DM <@user> their private coaching — they need to enable DMs from server members in Privacy Settings. Captain can run `/match coach @user <match-id>` to retry."*
- marks the job `done` (no retry — DM settings won't change without user action)

The `private` block is still persisted in `ai_summaries.output`, so a later `/match coach` retry doesn't re-call Gemini if the prompt hash matches.

**Opt-out**: not in v1. If a player wants to stop receiving DM coaching, they can block the bot via Discord's privacy settings. Add explicit per-player opt-out to the v2 parking lot only if requested.

## 9. Permissions

- Each slash command declares a required role: `captain` | `member` | `anyone`
- Resolution at call time: load `teams` row by `guild_id`, compare interaction user's roles against `captain_role_id`/`member_role_id`
- Server admins (`Administrator` permission) bypass all role checks — escape hatch for first install, before roles are configured
- All inputs (Discord IDs, IGNs, dates) parsed by zod before reaching use cases
- `/link` is gated by `member-role` per the brainstorm; captain-managed `/roster add` is the override path
- **Role assignment is captain-only**: `/link` never accepts a role; players cannot self-assign or change their own role. Role is set exclusively via `/roster add @user … <role>` (initial) or `/roster set-role @user <role>` (change), both captain-gated. AI summaries that run before a player has a role assigned default to "flex" criteria for that match and add a note in the public block: *"@player has no assigned role yet — captain, set one with `/roster set-role` for sharper coaching."*

## 10. Configuration

`.env` (zod-validated at boot, fail fast on missing/invalid):

```
DISCORD_TOKEN=
DISCORD_APP_ID=
HENRIK_API_KEY=                  # optional, raises rate limits
GEMINI_API_KEY=
DB_PATH=./data/premier.db
LOG_LEVEL=info                   # trace|debug|info|warn|error
NODE_ENV=production
```

## 11. Deployment (self-hosted)

- `pnpm install --prod && pnpm build`
- `node dist/main.js`
- `systemd/premier-bot.service` unit file with `Restart=on-failure`, `EnvironmentFile=/etc/premier-bot.env`, runs as a dedicated unprivileged user
- `pnpm register-commands` is a one-shot script that registers slash commands globally; run once after deploy and after any command-schema change
- Optional `Dockerfile` (alpine + node 22) for users who prefer containers

## 12. Testing

- **Unit (vitest)**: every use case in `src/app/` with mocked ports; ≥80% line coverage on `app/` and `domain/`
- **Adapter contract tests**: Henrik + Gemini adapters tested against recorded fixtures (no live calls in CI)
- **Integration**: in-memory SQLite, full `pollPremier → ingestMatch → summarize` flow with mocked HTTP
- **No live-Discord E2E**: interaction layer tested via `discord.js` builders + structural assertions on outgoing payloads

## 13. Open questions / parking lot

Tracked here so they aren't forgotten when scope expands:

- Multi-team per Discord server (would require namespacing all `guild_id` keys with a `team_slug`)
- Web dashboard for stats and VOD library
- Tournament bracket / playoff support
- Twitch / YouTube live-stream notifications
- Voice channel auto-create on confirmed scrim
- Demo file (`.dem`) parsing for granular round data
- Per-map / per-agent heatmaps and round-by-round breakdown
