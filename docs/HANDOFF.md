# premier-bot — Session Handoff

**Last updated**: 2026-05-03
**Status**: Plan 1 (MVP) complete + committed on `mvp-impl` branch. Plans 2/3/4 pending.

If you've just `/clear`ed and are resuming work on this project, **read this whole file first** — it has everything you need to pick up where we stopped.

---

## TL;DR — what's done, what's next

**Done (on `mvp-impl` branch, not yet merged):**
- Full design spec at `docs/superpowers/specs/2026-05-03-premier-bot-design.md`
- Full Plan 1 (MVP) at `docs/superpowers/plans/2026-05-03-premier-bot-mvp.md`
- All 36 plan tasks executed via subagent-driven-development
- 75/75 tests pass, `pnpm build` clean, `pnpm tsc --noEmit` clean
- Bot is runnable end-to-end (just needs `.env` populated + `pnpm register-commands`)

**Next user instruction**: *"finish the whole thing"* — meaning write + execute Plans 2, 3, 4.

---

## Project at a glance

A **self-hosted Discord bot** for managing a single Valorant Premier team per Discord server.

**Stack**: Node 22 + TypeScript strict + discord.js v14 + better-sqlite3 (WAL) + zod 4 + pino + node-cron + vitest + biome + pnpm. Hexagonal architecture, `Result<T, DomainError>` everywhere, in-memory job queue with SQLite-backed state.

**Single-process, single-Node-instance**. No Redis, no external infra. Self-hosted on the user's box.

**Multi-guild capable** (one Discord server = one team), but a single instance can serve many guilds.

---

## What works in MVP (Plan 1, shipped)

Slash commands:
- `/team set region|conference|henrik-team-id|captain-role|member-role|channel <value>` (captain)
- `/team show` (captain)
- `/link <RiotName#TAG>` (member self-service, verifies via HenrikDev /account)
- `/unlink` (member)
- `/roster add @user RiotName#TAG [role]` (captain)
- `/roster remove @user` (captain)
- `/roster set-role @user duelist|initiator|controller|sentinel|flex` (captain)
- `/match latest` (member, re-ingests most recent)
- `/match link <id-or-url>` (member, manual ingest from Henrik id or tracker URL)
- `/help` (anyone)

Background:
- `node-cron` enqueues `pollPremier` every 5 min per guild
- `pollPremier` job diffs Henrik's match history vs `matches` table → enqueues `ingestMatch` for new ones
- `ingestMatch` job fetches detail → persists → posts stats embed in announcements channel + opens a per-match thread

---

## Plans still to write (in priority order)

### Plan 2 — AI coaching layer
Adds Gemini 2.5 Flash for per-player post-match analysis.

**Spec already covers** (§6.2, §8.1, §9):
- `AICoach` port + `GeminiAdapter`
- Per-player `PlayerCoaching` schema with **two blocks**:
  - `public` block (posted in match thread, blameless): tldr, highlight, focus_area, **role_involvement_pct + one-liner rationale**
  - `private` block (DM'd to player, candid): tldr, did_well[], improve[], coaching_tip, **role_involvement.criteria[] with per-criterion scores + evidence**
- `TeamCoaching` schema (team-level, public-only)
- Role-involvement scoring rubric (Duelist/Initiator/Controller/Sentinel/Flex) lives in `prompts/role-criteria.md`
- One Gemini call per player produces both blocks (cheaper, consistent tone)
- `summarizeMatch` job calls Gemini → posts public block in thread → DMs private block
- DM-disabled fallback: catch `DiscordAPIError 50007`, log warn, post ephemeral captain note, mark job done (no retry)
- Pre-role AI defaults to "flex" criteria + adds public nudge for captain to `/roster set-role`
- Adds `/match coach @player <match-id>` command to re-run AI for one player
- Captain-only role assignment is enforced by spec §9 + already implemented in MVP

**New tables for Plan 2** (via `migrations/0002_ai_summaries.sql`): `ai_summaries` (already in spec §5)

### Plan 3 — Scheduling (Premier-aware)
Adds the auto-pinging match-night flow.

**Spec already covers** (§5, §6.1.1, §7, §8.2):
- `team_match_nights` table (already in spec §5)
- HenrikDev seasons endpoint integration: `GET https://api.henrikdev.xyz/valorant/v1/premier/seasons/{region}` returns season-wide schedule with `scheduled_events[]` keyed by `event_id` → `events[]` → map name
- `getPremierSchedule(region, conference)` method on `MatchDataProvider` port — returns `UpcomingMatch[]` with `{ matchTimeStart, matchTimeEnd, eventType, mapName, mapId, conference, seasonId }`
- 6-hour in-memory cache per `(region, conference)`
- New command: `/team match-nights add|remove <weekday> [preference-order]` — declares which weekdays the team plays Premier (default SAT=1 primary, SUN=2 fallback)
- **§8.2 SAT→SUN→skip fallback poll ladder**:
  1. Every Monday 12:00 region-local, open primary-night poll for week's match
  2. Quorum threshold: 5 ✅ (configurable). Closes 24h before match start
  3. If quorum met → lock the night, ping `member-role` at T-60min and T-10min with map info
  4. If quorum fails → open fallback-night poll
  5. If fallback also fails → post "no quorum, skip week" + no further polls
- Scrim proposals: `/scrim propose <date> <time> [note]` (member), `/scrim cancel <id>` (captain), button-poll RSVP, auto-confirm at 5 ✅
- New tables: `scrims`, `rsvps` (already in spec §5)
- New jobs: `sendReminder` (T-60min, T-10min)

**User context for Plan 3**:
- Team's conference: **NA_US_WEST**
- Team plays **SAT primary, SUN fallback** (NOT Tue/Sat/Sun — they only do SAT/SUN)
- Riot enforces 2-game weekly cap in-game (bot doesn't enforce, just doesn't open redundant polls)
- Premier season payload sample is captured in conversation history (~500-line JSON blob from /v1/premier/seasons/na)

### Plan 4 — VOD review + season stats
- `/vod add <url> [match-id]` (member) — opens/links a thread
- `/vod note <vod-id> <mm:ss> [@player] <text>` (member) — timestamped review notes
- `/stats season` (member) — W-L, avg ADR, avg HS%, top agent picks per player, map win-rate. Season boundary from `season_id` on most recent match
- New tables: `vods`, `vod_notes` (already in spec §5)

---

## File map (what exists right now)

```
docs/
  HANDOFF.md                                          ← THIS FILE
  superpowers/
    specs/2026-05-03-premier-bot-design.md            ← Full spec, 4 commits worth of evolution
    plans/2026-05-03-premier-bot-mvp.md               ← Plan 1, 4736 lines, fully executed
migrations/
  0001_init.sql                                       ← teams, players, matches, jobs (incl. conference column)
src/
  main.ts                                             ← composition root, cron + worker
  config/env.ts                                       ← zod-validated env loader
  domain/
    result.ts                                         ← Result<T,E> + ok/err/map/flatMap/unwrap
    errors.ts                                         ← DomainError tagged union
  app/
    setTeamConfig.ts                                  ← validates region + conference
    setPlayerRole.ts                                  ← validates role enum
    linkPlayer.ts                                     ← Riot tag parse → provider.resolveAccount → upsert
    ingestMatch.ts                                    ← orchestrates: detail → persist → embed → thread
  ports/
    repositories.ts                                   ← Team/Player/Match/Job repos (TeamRecord has `conference: string | null`)
    matchData.ts                                      ← MatchDataProvider (resolveAccount, listRecentMatches, getMatchDetail)
    announcer.ts                                      ← MatchAnnouncer.postMatch
  adapters/
    sqlite/
      db.ts, migrator.ts, migrations.ts
      teamRepo.ts, playerRepo.ts, matchRepo.ts, jobRepo.ts
    henrik/
      schemas.ts, client.ts                           ← HenrikClient implements MatchDataProvider
    discord/
      client.ts                                       ← createDiscordClient (Guilds intent only)
      command.ts, permission.ts, registry.ts, router.ts
      announcer.ts                                    ← DiscordMatchAnnouncer
      embeds/matchEmbed.ts                            ← match stats embed
      commands/
        index.ts                                      ← allCommands(deps)
        help.ts, team.ts, link.ts, roster.ts, match.ts
  jobs/
    worker.ts                                         ← runOnce + startWorker (in-mem queue, SQLite-backed)
    pollPremier.ts                                    ← diffs Henrik history → enqueues ingestMatch
    ingestMatch.ts                                    ← thin handler wrapping app/ingestMatch
  lib/
    logger.ts, http.ts                                ← pino factory + fetchJson with 429 retry
scripts/
  register-commands.ts                                ← pnpm register-commands (one-shot)
tests/
  smoke.test.ts                                       ← + colocated *.test.ts files in src/
  config/env.test.ts
  fixtures/henrik/account.json, match-detail.json
systemd/premier-bot.service
Dockerfile
README.md
.env.example
package.json, pnpm-lock.yaml, tsconfig.json, biome.json, vitest.config.ts
```

---

## How to resume work

After `/clear`, the new session won't have any of this conversation. Start by:

1. **Read this file**: `cat docs/HANDOFF.md` (this exact file)
2. **Read the spec**: `cat docs/superpowers/specs/2026-05-03-premier-bot-design.md` — for Plans 2-4 reference
3. **Verify state**: `pnpm test && pnpm tsc --noEmit && git log --oneline -5` — should be all green
4. **Start the next plan** — recommend going **Plan 2 (AI coaching) first** because the user's main differentiator is per-player AI advice. Then Plan 3 (scheduling), then Plan 4 (VODs/stats).

**To write Plan 2**: invoke the `superpowers:writing-plans` skill with the spec sections §6.2 (Gemini schemas) + §8.1 (DM fallback) + §9 (captain-only role) as your reference. Output: `docs/superpowers/plans/2026-05-XX-premier-bot-plan-2-ai-coaching.md`. Then execute via `superpowers:subagent-driven-development` (same pattern as Plan 1).

**Auto mode is active** — execute autonomously, dispatch subagents, minimize interruptions.

---

## Important context the next session needs

- **HenrikDev API** is the data source (free, no key required but `HENRIK_API_KEY` env var raises rate limits). NOT TRN — TRN was the original ask but is gated; HenrikDev was chosen during brainstorm.
- **Gemini 2.5 Flash** for AI (free tier from aistudio.google.com). Plan 2 should use `@google/genai` SDK and structured-output mode (JSON schema in `responseSchema`).
- **Self-hosted** on the user's box (Linux WSL2). Plan 1 ships systemd unit + Dockerfile.
- **discord.js 14.26.4** — `ephemeral: true` is deprecated in favor of `flags: MessageFlags.Ephemeral` but still works. Migration is a future cleanup, not in any plan.
- **biome 2.4.14** — config is `assist.actions.source.organizeImports`, not `organizeImports` (we migrated in Task 2 fix).
- **pnpm 10** requires `pnpm.onlyBuiltDependencies: ['better-sqlite3', 'esbuild']` in package.json so native bindings build.
- **zod 4.4.2** — schema syntax in plans uses standard `z.object`/`z.array`/`.optional()`/`.nullable()`/`z.infer<>` which is stable.
- **`exactOptionalPropertyTypes: true`** in tsconfig — when a config field is optional, build the options object conditionally rather than passing `field: undefined` (see `src/lib/logger.ts` for the pattern).
- **TDD discipline**: every task with logic was test-first. Plan 1 has 75 tests across 22 files.
- **No comments in code** unless WHY is non-obvious. Plan 1 has zero needless comments.

---

## Recent commits on `mvp-impl`

```
08f1271 chore: deployment artifacts (systemd + Dockerfile + README)
fad71d4 feat: composition root + cron-driven pollPremier scheduling
e6b3135 feat(discord): /match latest + /match link
c28671f feat(jobs): ingestMatch handler
339d5f9 feat(jobs): pollPremier handler enqueues ingestMatch for new matches
955db06 feat(discord): MatchAnnouncer adapter (post embed + start thread)
251f9fd feat(app): ingestMatch use case + MatchAnnouncer port
9a3db72 feat(discord): match stats embed builder
76c04c2 feat(jobs): runOnce + startWorker with backoff + max attempts
ba22a3e feat(discord): /roster add/remove/set-role (captain only)
d9dd457 feat(app): linkPlayer use case + Riot#TAG parser
41b535b feat(discord): /link + /unlink commands
ac903ee feat(app): setTeamConfig use case with region + conference validation
239b39c feat(discord): /team set + /team show commands
… (35 more commits back to project init)
```

---

## User profile snapshot

- Captain of a Valorant Premier team in **NA_US_WEST** conference
- Plays Premier on **Saturday (primary) + Sunday (fallback)**
- 5-stack with self as captain → recommended self-role: **Controller** (Omen/Brimstone) for IGL pace
- Self-host environment: Linux (WSL2)
- Stack preferences (from CLAUDE.md): TypeScript, single quotes, no semis, 2-space indent, pnpm, functional > OOP, named exports, no `any`, zod for validation, hexagonal architecture, Result<T,E>, TDD London School
- Auto mode is active: prefer action, dispatch subagents, minimize interruption

---

## When in doubt

- **Spec is authoritative**: `docs/superpowers/specs/2026-05-03-premier-bot-design.md`
- **Plan 1 is the reference template** for Plans 2-4: same milestone structure, same TDD step pattern, same file conventions
- **Conventional commits**: `feat()`, `fix()`, `chore()`, `docs()`, `test()`
- **Always check the file actually changed** after `Edit`/`Write` — the hooks have given false-positive failures throughout this build; verify with `cat`/`grep`/`git diff` if uncertain
