# premier-bot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a self-hosted Discord bot that links each team member's Riot account, automatically ingests Valorant Premier matches, and posts stats embeds in a per-match thread. AI coaching, scrim scheduling, and VOD review are deferred to follow-up plans.

**Architecture:** Single Node 22 process. Hexagonal — pure domain + use cases, with Discord, HenrikDev, and SQLite behind ports. SQLite-persisted in-memory job queue keeps the gateway responsive. All inputs validated by zod at every boundary.

**Tech Stack:** Node 22 LTS, TypeScript strict, discord.js v14, better-sqlite3 (WAL), zod, pino, undici, node-cron, vitest, biome, pnpm.

**Spec reference:** `docs/superpowers/specs/2026-05-03-premier-bot-design.md`

**Out of scope (follow-up plans):**
- Plan 2 — AI coaching (Gemini, public/private summaries, role-involvement %, DM fallback)
- Plan 3 — Scrim scheduling (`/scrim propose`, RSVP buttons, reminders, cron-driven Premier-night polling cadence)
- Plan 4 — VOD review + season stats (`/vod`, `/stats season`)

---

## Milestone 1 — Project foundation

### Task 1: Initialize pnpm + TypeScript project skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize pnpm package**

Run: `cd /home/night/projects/txt && pnpm init`
Expected: `package.json` created with defaults.

- [ ] **Step 2: Replace package.json with project version**

```json
{
  "name": "premier-bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node --enable-source-maps dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write .",
    "register-commands": "tsx scripts/register-commands.ts"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded", "trailingCommas": "all" }
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true, "suspicious": { "noExplicitAny": "error" } }
  }
}
```

- [ ] **Step 5: Append `dist/`, `data/` to .gitignore (already present from spec commit)**

Run: `grep -qxF 'dist/' .gitignore || echo 'dist/' >> .gitignore`
Run: `grep -qxF 'data/' .gitignore || echo 'data/' >> .gitignore`
Expected: no errors; both lines exist.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json biome.json .gitignore
git commit -m "chore: bootstrap pnpm + TypeScript + biome"
```

---

### Task 2: Install runtime + dev dependencies

**Files:**
- Modify: `package.json` (via pnpm add)
- Create: `pnpm-lock.yaml`

- [ ] **Step 1: Install runtime deps**

Run: `pnpm add discord.js better-sqlite3 zod pino pino-pretty undici node-cron dotenv`
Expected: dependencies added to `package.json`.

- [ ] **Step 2: Install dev deps**

Run: `pnpm add -D typescript tsx vitest @vitest/coverage-v8 @types/node @types/better-sqlite3 @types/node-cron @biomejs/biome`
Expected: devDependencies added.

- [ ] **Step 3: Verify install**

Run: `pnpm tsc --version && pnpm vitest --version && pnpm biome --version`
Expected: all three print version strings.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add runtime + dev dependencies"
```

---

### Task 3: Vitest config + smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/app/**', 'src/domain/**'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
```

- [ ] **Step 2: Create failing smoke test**

```ts
import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts
git commit -m "test: add vitest config and smoke test"
```

---

### Task 4: Env config (zod-validated)

**Files:**
- Create: `src/config/env.ts`
- Create: `tests/config/env.test.ts`
- Create: `.env.example`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env.js'

describe('loadEnv', () => {
  it('parses a valid env object', () => {
    const env = loadEnv({
      DISCORD_TOKEN: 't',
      DISCORD_APP_ID: 'a',
      GEMINI_API_KEY: 'g',
      DB_PATH: './data/premier.db',
      LOG_LEVEL: 'info',
      NODE_ENV: 'production',
    })
    expect(env.DISCORD_TOKEN).toBe('t')
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.HENRIK_API_KEY).toBeUndefined()
  })

  it('throws on missing required vars', () => {
    expect(() => loadEnv({ DB_PATH: './x' })).toThrow(/DISCORD_TOKEN/)
  })

  it('rejects invalid LOG_LEVEL', () => {
    expect(() =>
      loadEnv({
        DISCORD_TOKEN: 't',
        DISCORD_APP_ID: 'a',
        GEMINI_API_KEY: 'g',
        DB_PATH: './x',
        LOG_LEVEL: 'shouty',
        NODE_ENV: 'production',
      }),
    ).toThrow(/LOG_LEVEL/)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test tests/config/env.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement env loader**

```ts
import { z } from 'zod'

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  HENRIK_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  DB_PATH: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
})

export type Env = z.infer<typeof EnvSchema>

export const loadEnv = (raw: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`invalid environment: ${issues}`)
  }
  return parsed.data
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test tests/config/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create .env.example**

```
DISCORD_TOKEN=
DISCORD_APP_ID=
HENRIK_API_KEY=
GEMINI_API_KEY=
DB_PATH=./data/premier.db
LOG_LEVEL=info
NODE_ENV=production
```

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts .env.example
git commit -m "feat(config): zod-validated env loader"
```

---

## Milestone 2 — Domain primitives

### Task 5: Result<T,E> type

**Files:**
- Create: `src/domain/result.ts`
- Create: `src/domain/result.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { err, isErr, isOk, map, mapErr, ok, unwrap } from './result.js'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(isOk(r)).toBe(true)
    expect(isErr(r)).toBe(false)
    if (isOk(r)) expect(r.value).toBe(42)
  })

  it('err wraps an error', () => {
    const r = err('boom')
    expect(isErr(r)).toBe(true)
    if (isErr(r)) expect(r.error).toBe('boom')
  })

  it('map transforms Ok values', () => {
    const r = map(ok(2), (n) => n * 3)
    if (isOk(r)) expect(r.value).toBe(6)
  })

  it('map leaves Err untouched', () => {
    const r = map(err('x'), (n: number) => n * 3)
    if (isErr(r)) expect(r.error).toBe('x')
  })

  it('mapErr transforms Err values', () => {
    const r = mapErr(err('x'), (e) => `wrapped:${e}`)
    if (isErr(r)) expect(r.error).toBe('wrapped:x')
  })

  it('unwrap throws on Err', () => {
    expect(() => unwrap(err('boom'))).toThrow(/boom/)
  })

  it('unwrap returns value on Ok', () => {
    expect(unwrap(ok(7))).toBe(7)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/domain/result.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement Result**

```ts
export type Ok<T> = { readonly _tag: 'ok'; readonly value: T }
export type Err<E> = { readonly _tag: 'err'; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ _tag: 'ok', value })
export const err = <E>(error: E): Err<E> => ({ _tag: 'err', error })

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r._tag === 'ok'
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r._tag === 'err'

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  isOk(r) ? ok(f(r.value)) : r

export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> =>
  isErr(r) ? err(f(r.error)) : r

export const flatMap = <T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> =>
  isOk(r) ? f(r.value) : r

export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (isOk(r)) return r.value
  throw new Error(`unwrap on Err: ${JSON.stringify(r.error)}`)
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/domain/result.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/result.ts src/domain/result.test.ts
git commit -m "feat(domain): Result<T,E> with map/flatMap/unwrap"
```

---

### Task 6: Domain errors

**Files:**
- Create: `src/domain/errors.ts`
- Create: `src/domain/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  conflict,
  isDomainError,
  notFound,
  providerError,
  validation,
} from './errors.js'

describe('DomainError', () => {
  it('builds a not_found error', () => {
    const e = notFound('player', 'puuid:abc')
    expect(e.tag).toBe('not_found')
    expect(e.entity).toBe('player')
    expect(e.id).toBe('puuid:abc')
  })

  it('builds a validation error with field details', () => {
    const e = validation('riot_tag', 'must be 3-5 chars')
    expect(e.tag).toBe('validation')
    expect(e.field).toBe('riot_tag')
  })

  it('builds a conflict error', () => {
    const e = conflict('player already linked')
    expect(e.tag).toBe('conflict')
  })

  it('builds a provider_error with kind + message', () => {
    const e = providerError('henrik', 'rate_limited', 'try later')
    expect(e.tag).toBe('provider_error')
    expect(e.provider).toBe('henrik')
    expect(e.kind).toBe('rate_limited')
  })

  it('isDomainError narrows', () => {
    expect(isDomainError(notFound('x', 'y'))).toBe(true)
    expect(isDomainError({ random: true })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/domain/errors.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement errors**

```ts
export type NotFound = { readonly tag: 'not_found'; readonly entity: string; readonly id: string }
export type Validation = {
  readonly tag: 'validation'
  readonly field: string
  readonly message: string
}
export type Conflict = { readonly tag: 'conflict'; readonly message: string }
export type ProviderError = {
  readonly tag: 'provider_error'
  readonly provider: 'henrik' | 'gemini' | 'discord'
  readonly kind: 'rate_limited' | 'unauthorized' | 'unavailable' | 'bad_response' | 'unknown'
  readonly message: string
}

export type DomainError = NotFound | Validation | Conflict | ProviderError

const TAGS = new Set<DomainError['tag']>([
  'not_found',
  'validation',
  'conflict',
  'provider_error',
])

export const notFound = (entity: string, id: string): NotFound => ({
  tag: 'not_found',
  entity,
  id,
})

export const validation = (field: string, message: string): Validation => ({
  tag: 'validation',
  field,
  message,
})

export const conflict = (message: string): Conflict => ({ tag: 'conflict', message })

export const providerError = (
  provider: ProviderError['provider'],
  kind: ProviderError['kind'],
  message: string,
): ProviderError => ({ tag: 'provider_error', provider, kind, message })

export const isDomainError = (x: unknown): x is DomainError =>
  typeof x === 'object' &&
  x !== null &&
  'tag' in x &&
  TAGS.has((x as { tag: DomainError['tag'] }).tag)
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/domain/errors.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/errors.ts src/domain/errors.test.ts
git commit -m "feat(domain): tagged DomainError union"
```

---

### Task 7: Logger

**Files:**
- Create: `src/lib/logger.ts`

- [ ] **Step 1: Implement logger**

```ts
import pino from 'pino'
import type { Env } from '../config/env.js'

export const createLogger = (env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>) =>
  pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    base: { app: 'premier-bot' },
  })

export type Logger = ReturnType<typeof createLogger>
```

- [ ] **Step 2: Smoke test the logger**

Run: `pnpm tsx -e "import {createLogger} from './src/lib/logger.ts'; createLogger({LOG_LEVEL:'info',NODE_ENV:'production'}).info('hi')"`
Expected: a JSON log line printed to stdout.

- [ ] **Step 3: Commit**

```bash
git add src/lib/logger.ts
git commit -m "feat(lib): pino logger factory"
```

---

## Milestone 3 — SQLite + migrations

### Task 8: Migration runner

**Files:**
- Create: `src/adapters/sqlite/migrator.ts`
- Create: `src/adapters/sqlite/migrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './migrator.js'

describe('runMigrations', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => db.close())

  it('applies migrations in order and records them', () => {
    runMigrations(db, [
      { id: '001_a', sql: 'CREATE TABLE a (id INTEGER)' },
      { id: '002_b', sql: 'CREATE TABLE b (id INTEGER)' },
    ])
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(tables).toContain('a')
    expect(tables).toContain('b')
    expect(tables).toContain('schema_migrations')
  })

  it('skips already-applied migrations', () => {
    runMigrations(db, [{ id: '001_a', sql: 'CREATE TABLE a (id INTEGER)' }])
    runMigrations(db, [{ id: '001_a', sql: 'CREATE TABLE a (id INTEGER)' }])
    const count = db
      .prepare('SELECT COUNT(*) as c FROM schema_migrations')
      .get() as { c: number }
    expect(count.c).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/migrator.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement migrator**

```ts
import type Database from 'better-sqlite3'

export type Migration = { id: string; sql: string }

export const runMigrations = (db: Database.Database, migrations: Migration[]): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r) => (r as { id: string }).id),
  )
  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  )
  const tx = db.transaction((m: Migration) => {
    db.exec(m.sql)
    insert.run(m.id, Date.now())
  })
  for (const m of migrations) {
    if (applied.has(m.id)) continue
    tx(m)
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/migrator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/migrator.ts src/adapters/sqlite/migrator.test.ts
git commit -m "feat(sqlite): idempotent migration runner"
```

---

### Task 9: Initial migration (0001_init.sql)

**Files:**
- Create: `migrations/0001_init.sql`
- Create: `src/adapters/sqlite/migrations.ts`

- [ ] **Step 1: Write the migration SQL**

`migrations/0001_init.sql`:

```sql
CREATE TABLE teams (
  guild_id TEXT PRIMARY KEY,
  henrik_team_id TEXT,
  region TEXT,
  conference TEXT,
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
  role TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, discord_id)
);
CREATE UNIQUE INDEX players_puuid_per_guild ON players (guild_id, puuid);

CREATE TABLE matches (
  guild_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  season_id TEXT,
  played_at INTEGER NOT NULL,
  map TEXT,
  result TEXT,
  score_us INTEGER,
  score_them INTEGER,
  raw_json TEXT NOT NULL,
  thread_id TEXT,
  PRIMARY KEY (guild_id, match_id)
);
CREATE INDEX matches_season ON matches (guild_id, season_id);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL
);
CREATE INDEX jobs_status_run_at ON jobs (status, run_at);
```

- [ ] **Step 2: Bundle migrations into a typed array**

`src/adapters/sqlite/migrations.ts`:

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Migration } from './migrator.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

export const ALL_MIGRATIONS: Migration[] = [
  { id: '0001_init', sql: readFileSync(resolve(root, 'migrations/0001_init.sql'), 'utf8') },
]
```

- [ ] **Step 3: Add a smoke test that applies all migrations**

`src/adapters/sqlite/migrations.test.ts`:

```ts
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ALL_MIGRATIONS } from './migrations.js'
import { runMigrations } from './migrator.js'

describe('ALL_MIGRATIONS', () => {
  it('applies cleanly to a fresh DB', () => {
    const db = new Database(':memory:')
    runMigrations(db, ALL_MIGRATIONS)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(tables).toEqual(
      expect.arrayContaining(['teams', 'players', 'matches', 'jobs', 'schema_migrations']),
    )
    db.close()
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/adapters/sqlite/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/0001_init.sql src/adapters/sqlite/migrations.ts src/adapters/sqlite/migrations.test.ts
git commit -m "feat(sqlite): 0001_init migration with teams/players/matches/jobs"
```

---

### Task 10: DB connection factory

**Files:**
- Create: `src/adapters/sqlite/db.ts`
- Create: `src/adapters/sqlite/db.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { openDb } from './db.js'

describe('openDb', () => {
  it('opens an in-memory db with WAL disabled', () => {
    const db = openDb(':memory:')
    expect(db.open).toBe(true)
    db.close()
  })

  it('applies all migrations on open', () => {
    const db = openDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]
    expect(tables.some((t) => t.name === 'teams')).toBe(true)
    db.close()
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/db.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement openDb**

```ts
import Database from 'better-sqlite3'
import { ALL_MIGRATIONS } from './migrations.js'
import { runMigrations } from './migrator.js'

export type Db = Database.Database

export const openDb = (path: string): Db => {
  const db = new Database(path)
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
  }
  db.pragma('foreign_keys = ON')
  runMigrations(db, ALL_MIGRATIONS)
  return db
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/db.ts src/adapters/sqlite/db.test.ts
git commit -m "feat(sqlite): openDb factory with WAL + migrations"
```

---

## Milestone 4 — Repositories

### Task 11: Ports for repositories

**Files:**
- Create: `src/ports/repositories.ts`

- [ ] **Step 1: Write the port interfaces**

```ts
import type { Result } from '../domain/result.js'
import type { DomainError } from '../domain/errors.js'

export type TeamRecord = {
  guildId: string
  henrikTeamId: string | null
  region: string | null
  conference: string | null
  captainRoleId: string | null
  memberRoleId: string | null
  announcementsChannelId: string | null
  createdAt: number
}

export type PlayerRecord = {
  guildId: string
  discordId: string
  riotName: string
  riotTag: string
  puuid: string
  role: string | null
  addedBy: string
  createdAt: number
}

export type MatchRecord = {
  guildId: string
  matchId: string
  seasonId: string | null
  playedAt: number
  map: string | null
  result: 'win' | 'loss' | 'draw' | 'no_result' | null
  scoreUs: number | null
  scoreThem: number | null
  rawJson: string
  threadId: string | null
}

export type JobRecord = {
  id: number
  kind: string
  payloadJson: string
  runAt: number
  attempts: number
  lastError: string | null
  status: 'pending' | 'running' | 'done' | 'failed'
}

export interface TeamRepository {
  upsert(team: Partial<TeamRecord> & { guildId: string }): Result<TeamRecord, DomainError>
  findByGuild(guildId: string): Result<TeamRecord | null, DomainError>
}

export interface PlayerRepository {
  upsert(player: Omit<PlayerRecord, 'createdAt'>): Result<PlayerRecord, DomainError>
  setRole(guildId: string, discordId: string, role: string | null): Result<void, DomainError>
  remove(guildId: string, discordId: string): Result<void, DomainError>
  findByDiscordId(guildId: string, discordId: string): Result<PlayerRecord | null, DomainError>
  findByPuuid(guildId: string, puuid: string): Result<PlayerRecord | null, DomainError>
  listByGuild(guildId: string): Result<PlayerRecord[], DomainError>
}

export interface MatchRepository {
  insert(match: MatchRecord): Result<void, DomainError>
  findByMatchId(guildId: string, matchId: string): Result<MatchRecord | null, DomainError>
  setThreadId(guildId: string, matchId: string, threadId: string): Result<void, DomainError>
  listRecent(guildId: string, limit: number): Result<MatchRecord[], DomainError>
}

export interface JobRepository {
  enqueue(kind: string, payload: unknown, runAt?: number): Result<number, DomainError>
  claimNext(now: number): Result<JobRecord | null, DomainError>
  markDone(id: number): Result<void, DomainError>
  markFailed(id: number, error: string, nextRunAt: number | null): Result<void, DomainError>
}
```

- [ ] **Step 2: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/ports/repositories.ts
git commit -m "feat(ports): repository interfaces"
```

---

### Task 12: SqliteTeamRepository

**Files:**
- Create: `src/adapters/sqlite/teamRepo.ts`
- Create: `src/adapters/sqlite/teamRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteTeamRepository } from './teamRepo.js'

describe('SqliteTeamRepository', () => {
  let db: Db
  let repo: SqliteTeamRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteTeamRepository(db)
  })

  afterEach(() => db.close())

  it('returns null for unknown guild', () => {
    const r = repo.findByGuild('g1')
    if (isOk(r)) expect(r.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('upserts a new team and reads it back', () => {
    const u = repo.upsert({ guildId: 'g1', region: 'na', henrikTeamId: 't-1' })
    if (isErr(u)) throw new Error(JSON.stringify(u.error))
    expect(u.value.guildId).toBe('g1')
    expect(u.value.region).toBe('na')

    const r = repo.findByGuild('g1')
    if (isOk(r) && r.value) {
      expect(r.value.region).toBe('na')
      expect(r.value.henrikTeamId).toBe('t-1')
    } else {
      throw new Error('expected found team')
    }
  })

  it('upsert merges fields without clobbering unset ones', () => {
    repo.upsert({ guildId: 'g1', region: 'na', henrikTeamId: 't-1' })
    repo.upsert({ guildId: 'g1', captainRoleId: 'r-cap' })
    const r = repo.findByGuild('g1')
    if (isOk(r) && r.value) {
      expect(r.value.region).toBe('na')
      expect(r.value.henrikTeamId).toBe('t-1')
      expect(r.value.captainRoleId).toBe('r-cap')
    } else {
      throw new Error('expected found team')
    }
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/teamRepo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement SqliteTeamRepository**

```ts
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { TeamRecord, TeamRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  henrik_team_id: string | null
  region: string | null
  conference: string | null
  captain_role_id: string | null
  member_role_id: string | null
  announcements_channel_id: string | null
  created_at: number
}

const toRecord = (r: Row): TeamRecord => ({
  guildId: r.guild_id,
  henrikTeamId: r.henrik_team_id,
  region: r.region,
  conference: r.conference,
  captainRoleId: r.captain_role_id,
  memberRoleId: r.member_role_id,
  announcementsChannelId: r.announcements_channel_id,
  createdAt: r.created_at,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: Db) {}

  findByGuild(guildId: string): Result<TeamRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string], Row>('SELECT * FROM teams WHERE guild_id = ?')
        .get(guildId)
      return row ? toRecord(row) : null
    })
  }

  upsert(
    patch: Partial<TeamRecord> & { guildId: string },
  ): Result<TeamRecord, DomainError> {
    return wrap(() => {
      const existing = this.db
        .prepare<[string], Row>('SELECT * FROM teams WHERE guild_id = ?')
        .get(patch.guildId)
      const merged: TeamRecord = {
        guildId: patch.guildId,
        henrikTeamId: patch.henrikTeamId ?? existing?.henrik_team_id ?? null,
        region: patch.region ?? existing?.region ?? null,
        conference: patch.conference ?? existing?.conference ?? null,
        captainRoleId: patch.captainRoleId ?? existing?.captain_role_id ?? null,
        memberRoleId: patch.memberRoleId ?? existing?.member_role_id ?? null,
        announcementsChannelId:
          patch.announcementsChannelId ?? existing?.announcements_channel_id ?? null,
        createdAt: existing?.created_at ?? Date.now(),
      }
      this.db
        .prepare(
          `INSERT INTO teams (guild_id, henrik_team_id, region, conference, captain_role_id, member_role_id, announcements_channel_id, created_at)
           VALUES (@guildId, @henrikTeamId, @region, @conference, @captainRoleId, @memberRoleId, @announcementsChannelId, @createdAt)
           ON CONFLICT(guild_id) DO UPDATE SET
             henrik_team_id = excluded.henrik_team_id,
             region = excluded.region,
             conference = excluded.conference,
             captain_role_id = excluded.captain_role_id,
             member_role_id = excluded.member_role_id,
             announcements_channel_id = excluded.announcements_channel_id`,
        )
        .run(merged)
      return merged
    })
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/teamRepo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/teamRepo.ts src/adapters/sqlite/teamRepo.test.ts
git commit -m "feat(sqlite): SqliteTeamRepository (upsert merges patches)"
```

---

### Task 13: SqlitePlayerRepository

**Files:**
- Create: `src/adapters/sqlite/playerRepo.ts`
- Create: `src/adapters/sqlite/playerRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqlitePlayerRepository } from './playerRepo.js'

const sample = {
  guildId: 'g1',
  discordId: 'u1',
  riotName: 'Player',
  riotTag: 'NA1',
  puuid: 'pu-1',
  role: null,
  addedBy: 'self',
}

describe('SqlitePlayerRepository', () => {
  let db: Db
  let repo: SqlitePlayerRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqlitePlayerRepository(db)
  })

  afterEach(() => db.close())

  it('upserts a new player and finds them', () => {
    const u = repo.upsert(sample)
    if (isErr(u)) throw new Error(JSON.stringify(u.error))

    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) {
      expect(f.value.puuid).toBe('pu-1')
      expect(f.value.role).toBeNull()
    } else throw new Error('expected found')
  })

  it('upsert overwrites tag/puuid for the same discord_id', () => {
    repo.upsert(sample)
    repo.upsert({ ...sample, riotTag: 'EU1', puuid: 'pu-2' })
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) {
      expect(f.value.riotTag).toBe('EU1')
      expect(f.value.puuid).toBe('pu-2')
    } else throw new Error('expected found')
  })

  it('rejects duplicate puuid for different discord users in same guild', () => {
    repo.upsert(sample)
    const r = repo.upsert({ ...sample, discordId: 'u2' })
    expect(isErr(r)).toBe(true)
  })

  it('setRole updates only the role', () => {
    repo.upsert(sample)
    repo.setRole('g1', 'u1', 'duelist')
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f) && f.value) expect(f.value.role).toBe('duelist')
    else throw new Error('expected found')
  })

  it('remove deletes the player', () => {
    repo.upsert(sample)
    repo.remove('g1', 'u1')
    const f = repo.findByDiscordId('g1', 'u1')
    if (isOk(f)) expect(f.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('listByGuild returns all players in the guild', () => {
    repo.upsert(sample)
    repo.upsert({ ...sample, discordId: 'u2', puuid: 'pu-2' })
    const f = repo.listByGuild('g1')
    if (isOk(f)) expect(f.value).toHaveLength(2)
    else throw new Error('expected ok')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/playerRepo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement SqlitePlayerRepository**

```ts
import type { DomainError } from '../../domain/errors.js'
import { conflict, providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { PlayerRecord, PlayerRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  discord_id: string
  riot_name: string
  riot_tag: string
  puuid: string
  role: string | null
  added_by: string
  created_at: number
}

const toRecord = (r: Row): PlayerRecord => ({
  guildId: r.guild_id,
  discordId: r.discord_id,
  riotName: r.riot_name,
  riotTag: r.riot_tag,
  puuid: r.puuid,
  role: r.role,
  addedBy: r.added_by,
  createdAt: r.created_at,
})

export class SqlitePlayerRepository implements PlayerRepository {
  constructor(private readonly db: Db) {}

  upsert(p: Omit<PlayerRecord, 'createdAt'>): Result<PlayerRecord, DomainError> {
    try {
      const createdAt = Date.now()
      this.db
        .prepare(
          `INSERT INTO players (guild_id, discord_id, riot_name, riot_tag, puuid, role, added_by, created_at)
           VALUES (@guildId, @discordId, @riotName, @riotTag, @puuid, @role, @addedBy, @createdAt)
           ON CONFLICT(guild_id, discord_id) DO UPDATE SET
             riot_name = excluded.riot_name,
             riot_tag = excluded.riot_tag,
             puuid = excluded.puuid,
             added_by = excluded.added_by`,
        )
        .run({ ...p, createdAt })
      return ok({ ...p, createdAt })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('UNIQUE') && msg.includes('players_puuid_per_guild')) {
        return err(conflict(`puuid ${p.puuid} is already linked to another Discord user`))
      }
      return err(providerError('discord', 'unknown', msg))
    }
  }

  setRole(guildId: string, discordId: string, role: string | null): Result<void, DomainError> {
    try {
      this.db
        .prepare('UPDATE players SET role = ? WHERE guild_id = ? AND discord_id = ?')
        .run(role, guildId, discordId)
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  remove(guildId: string, discordId: string): Result<void, DomainError> {
    try {
      this.db
        .prepare('DELETE FROM players WHERE guild_id = ? AND discord_id = ?')
        .run(guildId, discordId)
      return ok(undefined)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  findByDiscordId(guildId: string, discordId: string): Result<PlayerRecord | null, DomainError> {
    try {
      const row = this.db
        .prepare<[string, string], Row>(
          'SELECT * FROM players WHERE guild_id = ? AND discord_id = ?',
        )
        .get(guildId, discordId)
      return ok(row ? toRecord(row) : null)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  findByPuuid(guildId: string, puuid: string): Result<PlayerRecord | null, DomainError> {
    try {
      const row = this.db
        .prepare<[string, string], Row>('SELECT * FROM players WHERE guild_id = ? AND puuid = ?')
        .get(guildId, puuid)
      return ok(row ? toRecord(row) : null)
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }

  listByGuild(guildId: string): Result<PlayerRecord[], DomainError> {
    try {
      const rows = this.db
        .prepare<[string], Row>('SELECT * FROM players WHERE guild_id = ? ORDER BY created_at')
        .all(guildId)
      return ok(rows.map(toRecord))
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/playerRepo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/playerRepo.ts src/adapters/sqlite/playerRepo.test.ts
git commit -m "feat(sqlite): SqlitePlayerRepository with conflict mapping"
```

---

### Task 14: SqliteMatchRepository

**Files:**
- Create: `src/adapters/sqlite/matchRepo.ts`
- Create: `src/adapters/sqlite/matchRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteMatchRepository } from './matchRepo.js'

const sample = {
  guildId: 'g1',
  matchId: 'm-1',
  seasonId: 's-1',
  playedAt: 1_700_000_000_000,
  map: 'Ascent',
  result: 'win' as const,
  scoreUs: 13,
  scoreThem: 7,
  rawJson: '{}',
  threadId: null,
}

describe('SqliteMatchRepository', () => {
  let db: Db
  let repo: SqliteMatchRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteMatchRepository(db)
  })

  afterEach(() => db.close())

  it('inserts and finds a match', () => {
    repo.insert(sample)
    const f = repo.findByMatchId('g1', 'm-1')
    if (isOk(f) && f.value) {
      expect(f.value.map).toBe('Ascent')
      expect(f.value.result).toBe('win')
    } else throw new Error('expected found')
  })

  it('setThreadId updates the thread id', () => {
    repo.insert(sample)
    repo.setThreadId('g1', 'm-1', 'thread-9')
    const f = repo.findByMatchId('g1', 'm-1')
    if (isOk(f) && f.value) expect(f.value.threadId).toBe('thread-9')
    else throw new Error('expected found')
  })

  it('listRecent returns matches newest first', () => {
    repo.insert({ ...sample, matchId: 'm-1', playedAt: 100 })
    repo.insert({ ...sample, matchId: 'm-2', playedAt: 200 })
    const f = repo.listRecent('g1', 5)
    if (isOk(f)) expect(f.value.map((m) => m.matchId)).toEqual(['m-2', 'm-1'])
    else throw new Error('expected ok')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/matchRepo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement SqliteMatchRepository**

```ts
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { MatchRecord, MatchRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  guild_id: string
  match_id: string
  season_id: string | null
  played_at: number
  map: string | null
  result: 'win' | 'loss' | 'draw' | 'no_result' | null
  score_us: number | null
  score_them: number | null
  raw_json: string
  thread_id: string | null
}

const toRecord = (r: Row): MatchRecord => ({
  guildId: r.guild_id,
  matchId: r.match_id,
  seasonId: r.season_id,
  playedAt: r.played_at,
  map: r.map,
  result: r.result,
  scoreUs: r.score_us,
  scoreThem: r.score_them,
  rawJson: r.raw_json,
  threadId: r.thread_id,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteMatchRepository implements MatchRepository {
  constructor(private readonly db: Db) {}

  insert(m: MatchRecord): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO matches (guild_id, match_id, season_id, played_at, map, result, score_us, score_them, raw_json, thread_id)
           VALUES (@guildId, @matchId, @seasonId, @playedAt, @map, @result, @scoreUs, @scoreThem, @rawJson, @threadId)`,
        )
        .run(m)
    })
  }

  findByMatchId(guildId: string, matchId: string): Result<MatchRecord | null, DomainError> {
    return wrap(() => {
      const row = this.db
        .prepare<[string, string], Row>(
          'SELECT * FROM matches WHERE guild_id = ? AND match_id = ?',
        )
        .get(guildId, matchId)
      return row ? toRecord(row) : null
    })
  }

  setThreadId(guildId: string, matchId: string, threadId: string): Result<void, DomainError> {
    return wrap(() => {
      this.db
        .prepare('UPDATE matches SET thread_id = ? WHERE guild_id = ? AND match_id = ?')
        .run(threadId, guildId, matchId)
    })
  }

  listRecent(guildId: string, limit: number): Result<MatchRecord[], DomainError> {
    return wrap(() => {
      const rows = this.db
        .prepare<[string, number], Row>(
          'SELECT * FROM matches WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?',
        )
        .all(guildId, limit)
      return rows.map(toRecord)
    })
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/matchRepo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/matchRepo.ts src/adapters/sqlite/matchRepo.test.ts
git commit -m "feat(sqlite): SqliteMatchRepository"
```

---

### Task 15: SqliteJobRepository

**Files:**
- Create: `src/adapters/sqlite/jobRepo.ts`
- Create: `src/adapters/sqlite/jobRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { type Db, openDb } from './db.js'
import { SqliteJobRepository } from './jobRepo.js'

describe('SqliteJobRepository', () => {
  let db: Db
  let repo: SqliteJobRepository

  beforeEach(() => {
    db = openDb(':memory:')
    repo = new SqliteJobRepository(db)
  })

  afterEach(() => db.close())

  it('enqueues and claims pending jobs', () => {
    const e = repo.enqueue('test_job', { x: 1 })
    if (!isOk(e)) throw new Error('enqueue failed')
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c) && c.value) {
      expect(c.value.kind).toBe('test_job')
      expect(c.value.status).toBe('running')
      expect(JSON.parse(c.value.payloadJson)).toEqual({ x: 1 })
    } else throw new Error('expected claimed job')
  })

  it('does not claim jobs whose run_at is in the future', () => {
    repo.enqueue('test_job', {}, Date.now() + 60_000)
    const c = repo.claimNext(Date.now())
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('markDone moves status to done', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markDone(e.value)
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })

  it('markFailed with nextRunAt re-queues for retry', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markFailed(e.value, 'boom', Date.now() + 100)
    const c = repo.claimNext(Date.now() + 1000)
    if (isOk(c) && c.value) {
      expect(c.value.attempts).toBe(2)
      expect(c.value.lastError).toBe('boom')
    } else throw new Error('expected re-claimed')
  })

  it('markFailed with null nextRunAt sets status=failed', () => {
    const e = repo.enqueue('test_job', {})
    if (!isOk(e)) throw new Error('enqueue failed')
    repo.claimNext(Date.now() + 1000)
    repo.markFailed(e.value, 'fatal', null)
    const c = repo.claimNext(Date.now() + 1_000_000)
    if (isOk(c)) expect(c.value).toBeNull()
    else throw new Error('expected ok')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/sqlite/jobRepo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement SqliteJobRepository**

```ts
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { JobRecord, JobRepository } from '../../ports/repositories.js'
import type { Db } from './db.js'

type Row = {
  id: number
  kind: string
  payload_json: string
  run_at: number
  attempts: number
  last_error: string | null
  status: 'pending' | 'running' | 'done' | 'failed'
}

const toRecord = (r: Row): JobRecord => ({
  id: r.id,
  kind: r.kind,
  payloadJson: r.payload_json,
  runAt: r.run_at,
  attempts: r.attempts,
  lastError: r.last_error,
  status: r.status,
})

const wrap = <T>(fn: () => T): Result<T, DomainError> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(providerError('discord', 'unknown', (e as Error).message))
  }
}

export class SqliteJobRepository implements JobRepository {
  constructor(private readonly db: Db) {}

  enqueue(kind: string, payload: unknown, runAt = Date.now()): Result<number, DomainError> {
    return wrap(() => {
      const info = this.db
        .prepare(
          `INSERT INTO jobs (kind, payload_json, run_at, attempts, status)
           VALUES (?, ?, ?, 0, 'pending')`,
        )
        .run(kind, JSON.stringify(payload), runAt)
      return Number(info.lastInsertRowid)
    })
  }

  claimNext(now: number): Result<JobRecord | null, DomainError> {
    return wrap(() => {
      const tx = this.db.transaction(() => {
        const row = this.db
          .prepare<[number], Row>(
            `SELECT * FROM jobs
             WHERE status = 'pending' AND run_at <= ?
             ORDER BY run_at ASC, id ASC LIMIT 1`,
          )
          .get(now)
        if (!row) return null
        this.db
          .prepare("UPDATE jobs SET status = 'running', attempts = attempts + 1 WHERE id = ?")
          .run(row.id)
        return toRecord({ ...row, status: 'running', attempts: row.attempts + 1 })
      })
      return tx()
    })
  }

  markDone(id: number): Result<void, DomainError> {
    return wrap(() => {
      this.db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(id)
    })
  }

  markFailed(id: number, error: string, nextRunAt: number | null): Result<void, DomainError> {
    return wrap(() => {
      if (nextRunAt === null) {
        this.db
          .prepare("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?")
          .run(error, id)
      } else {
        this.db
          .prepare(
            "UPDATE jobs SET status = 'pending', last_error = ?, run_at = ? WHERE id = ?",
          )
          .run(error, nextRunAt, id)
      }
    })
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/sqlite/jobRepo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sqlite/jobRepo.ts src/adapters/sqlite/jobRepo.test.ts
git commit -m "feat(sqlite): SqliteJobRepository (claim/done/fail with retry)"
```

---

## Milestone 5 — HenrikDev adapter

### Task 16: HTTP client wrapper with retry

**Files:**
- Create: `src/lib/http.ts`
- Create: `src/lib/http.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from './http.js'

describe('fetchJson', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.useRealTimers()
  })

  it('returns parsed JSON on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const r = await fetchJson('https://x', { headers: {} })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('retries on 429 then succeeds', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    globalThis.fetch = mock
    const promise = fetchJson('https://x', { headers: {}, maxRetries: 1, baseDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(15)
    const r = await promise
    expect(r.status).toBe(200)
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('returns last response after exhausting retries', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('rate', { status: 429 }))
    const promise = fetchJson('https://x', { headers: {}, maxRetries: 2, baseDelayMs: 1 })
    await vi.runAllTimersAsync()
    const r = await promise
    expect(r.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/lib/http.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement fetchJson**

```ts
export type FetchOpts = {
  method?: string
  headers: Record<string, string>
  body?: string
  maxRetries?: number
  baseDelayMs?: number
  timeoutMs?: number
}

export type JsonResponse = {
  status: number
  json: unknown
  rawText: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const fetchJson = async (url: string, opts: FetchOpts): Promise<JsonResponse> => {
  const max = opts.maxRetries ?? 3
  const base = opts.baseDelayMs ?? 500
  const timeout = opts.timeoutMs ?? 10_000

  let lastResp: Response | null = null
  for (let attempt = 0; attempt <= max; attempt++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeout)
    try {
      const resp = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        body: opts.body,
        signal: ctl.signal,
      })
      lastResp = resp
      if (resp.status !== 429 && resp.status < 500) {
        const text = await resp.text()
        return { status: resp.status, json: text ? safeJson(text) : null, rawText: text }
      }
    } catch (e) {
      if (attempt === max) throw e
    } finally {
      clearTimeout(timer)
    }
    if (attempt < max) await sleep(base * 2 ** attempt)
  }
  const text = lastResp ? await lastResp.text() : ''
  return { status: lastResp?.status ?? 0, json: text ? safeJson(text) : null, rawText: text }
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/lib/http.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/http.ts src/lib/http.test.ts
git commit -m "feat(lib): fetchJson with timeout + 429/5xx retry"
```

---

### Task 17: MatchDataProvider port + Henrik schemas

**Files:**
- Create: `src/ports/matchData.ts`
- Create: `src/adapters/henrik/schemas.ts`

- [ ] **Step 1: Define the port**

```ts
import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export type ResolvedAccount = { puuid: string; region: string }

export type MatchSummary = {
  matchId: string
  playedAt: number
  map: string | null
}

export type ScoreboardRow = {
  puuid: string
  riotName: string
  riotTag: string
  agent: string
  kills: number
  deaths: number
  assists: number
  adr: number
  hsPct: number
}

export type MatchDetail = {
  matchId: string
  seasonId: string | null
  playedAt: number
  map: string
  result: 'win' | 'loss' | 'draw' | 'no_result'
  scoreUs: number
  scoreThem: number
  ourPuuids: Set<string>
  scoreboard: ScoreboardRow[]
  raw: unknown
}

export interface MatchDataProvider {
  resolveAccount(name: string, tag: string): Promise<Result<ResolvedAccount, DomainError>>
  listRecentMatches(
    region: string,
    teamId: string,
  ): Promise<Result<MatchSummary[], DomainError>>
  getMatchDetail(
    region: string,
    matchId: string,
    teamPuuids: string[],
  ): Promise<Result<MatchDetail, DomainError>>
}
```

- [ ] **Step 2: Define Henrik response schemas**

```ts
import { z } from 'zod'

export const HenrikAccount = z.object({
  status: z.number(),
  data: z.object({
    puuid: z.string(),
    name: z.string(),
    tag: z.string(),
    region: z.string(),
  }),
})

export const HenrikPremierTeam = z.object({
  status: z.number(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    tag: z.string(),
    region: z.string(),
    members: z
      .array(z.object({ puuid: z.string(), name: z.string(), tag: z.string() }))
      .optional()
      .default([]),
  }),
})

export const HenrikPremierMatchSummary = z.object({
  id: z.string(),
  started_at: z.string(),
  map: z.object({ name: z.string() }).optional(),
})

export const HenrikPremierHistory = z.object({
  status: z.number(),
  data: z.object({
    matches: z.array(HenrikPremierMatchSummary).default([]),
  }),
})

export const HenrikMatchPlayer = z.object({
  puuid: z.string(),
  name: z.string(),
  tag: z.string(),
  team_id: z.string(),
  agent: z.object({ name: z.string() }),
  stats: z.object({
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    headshots: z.number(),
    bodyshots: z.number(),
    legshots: z.number(),
    damage: z.object({ dealt: z.number() }),
  }),
})

export const HenrikMatchDetail = z.object({
  status: z.number(),
  data: z.object({
    metadata: z.object({
      match_id: z.string(),
      started_at: z.string(),
      map: z.object({ name: z.string() }),
      season: z.object({ id: z.string() }).nullable().optional(),
    }),
    players: z.array(HenrikMatchPlayer),
    teams: z.array(
      z.object({ team_id: z.string(), won: z.boolean(), rounds: z.object({ won: z.number() }) }),
    ),
  }),
})

export type HenrikMatchDetailType = z.infer<typeof HenrikMatchDetail>
```

- [ ] **Step 3: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ports/matchData.ts src/adapters/henrik/schemas.ts
git commit -m "feat: MatchDataProvider port + HenrikDev zod schemas"
```

---

### Task 18: HenrikDev adapter

**Files:**
- Create: `src/adapters/henrik/client.ts`
- Create: `src/adapters/henrik/client.test.ts`
- Create: `tests/fixtures/henrik/account.json`
- Create: `tests/fixtures/henrik/match-detail.json`

- [ ] **Step 1: Add fixtures**

`tests/fixtures/henrik/account.json`:

```json
{
  "status": 200,
  "data": {
    "puuid": "PUUID-CAPTAIN",
    "name": "Captain",
    "tag": "NA1",
    "region": "na"
  }
}
```

`tests/fixtures/henrik/match-detail.json`:

```json
{
  "status": 200,
  "data": {
    "metadata": {
      "match_id": "M-123",
      "started_at": "2026-04-30T22:00:00.000Z",
      "map": { "name": "Ascent" },
      "season": { "id": "S-2026-A2" }
    },
    "players": [
      {
        "puuid": "PUUID-CAPTAIN",
        "name": "Captain",
        "tag": "NA1",
        "team_id": "Red",
        "agent": { "name": "Omen" },
        "stats": {
          "kills": 18,
          "deaths": 12,
          "assists": 7,
          "headshots": 24,
          "bodyshots": 32,
          "legshots": 4,
          "damage": { "dealt": 3120 }
        }
      },
      {
        "puuid": "PUUID-OPPONENT",
        "name": "Foe",
        "tag": "NA1",
        "team_id": "Blue",
        "agent": { "name": "Jett" },
        "stats": {
          "kills": 14,
          "deaths": 14,
          "assists": 3,
          "headshots": 18,
          "bodyshots": 30,
          "legshots": 2,
          "damage": { "dealt": 2600 }
        }
      }
    ],
    "teams": [
      { "team_id": "Red", "won": true, "rounds": { "won": 13 } },
      { "team_id": "Blue", "won": false, "rounds": { "won": 7 } }
    ]
  }
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { HenrikClient } from './client.js'

const accountFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/henrik/account.json'),
  'utf8',
)
const matchFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/henrik/match-detail.json'),
  'utf8',
)

describe('HenrikClient', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('resolves an account by name#tag', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(accountFixture, { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.resolveAccount('Captain', 'NA1')
    if (isOk(r)) {
      expect(r.value.puuid).toBe('PUUID-CAPTAIN')
      expect(r.value.region).toBe('na')
    } else throw new Error(JSON.stringify(r.error))
  })

  it('returns provider_error on bad response shape', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"unexpected":1}', { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.resolveAccount('Captain', 'NA1')
    if (isErr(r)) expect(r.error.tag).toBe('provider_error')
    else throw new Error('expected err')
  })

  it('parses a match detail and computes scoreUs/scoreThem from team puuids', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(matchFixture, { status: 200 }))
    const c = new HenrikClient({ apiKey: undefined })
    const r = await c.getMatchDetail('na', 'M-123', ['PUUID-CAPTAIN'])
    if (isOk(r)) {
      expect(r.value.matchId).toBe('M-123')
      expect(r.value.map).toBe('Ascent')
      expect(r.value.scoreUs).toBe(13)
      expect(r.value.scoreThem).toBe(7)
      expect(r.value.result).toBe('win')
      expect(r.value.seasonId).toBe('S-2026-A2')
      expect(r.value.scoreboard).toHaveLength(2)
    } else throw new Error(JSON.stringify(r.error))
  })
})
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm test src/adapters/henrik/client.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement HenrikClient**

```ts
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import { fetchJson } from '../../lib/http.js'
import type {
  MatchDataProvider,
  MatchDetail,
  MatchSummary,
  ResolvedAccount,
  ScoreboardRow,
} from '../../ports/matchData.js'
import {
  HenrikAccount,
  HenrikMatchDetail,
  type HenrikMatchDetailType,
  HenrikPremierHistory,
} from './schemas.js'

const BASE = 'https://api.henrikdev.xyz/valorant'

export type HenrikOpts = { apiKey?: string | undefined; baseUrl?: string }

export class HenrikClient implements MatchDataProvider {
  private readonly base: string
  private readonly headers: Record<string, string>

  constructor(opts: HenrikOpts) {
    this.base = opts.baseUrl ?? BASE
    this.headers = { Accept: 'application/json' }
    if (opts.apiKey) this.headers.Authorization = opts.apiKey
  }

  async resolveAccount(
    name: string,
    tag: string,
  ): Promise<Result<ResolvedAccount, DomainError>> {
    const url = `${this.base}/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 404) return err(providerError('henrik', 'unknown', 'account not found'))
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikAccount.safeParse(resp.json)
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok({ puuid: parsed.data.data.puuid, region: parsed.data.data.region })
  }

  async listRecentMatches(
    region: string,
    teamId: string,
  ): Promise<Result<MatchSummary[], DomainError>> {
    const url = `${this.base}/v1/premier/${encodeURIComponent(teamId)}/history?region=${encodeURIComponent(region)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikPremierHistory.safeParse(resp.json)
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok(
      parsed.data.data.matches.map((m) => ({
        matchId: m.id,
        playedAt: Date.parse(m.started_at),
        map: m.map?.name ?? null,
      })),
    )
  }

  async getMatchDetail(
    region: string,
    matchId: string,
    teamPuuids: string[],
  ): Promise<Result<MatchDetail, DomainError>> {
    const url = `${this.base}/v3/match/${encodeURIComponent(region)}/${encodeURIComponent(matchId)}`
    const resp = await fetchJson(url, { headers: this.headers })
    if (resp.status === 429) return err(providerError('henrik', 'rate_limited', 'rate limited'))
    if (resp.status >= 400)
      return err(providerError('henrik', 'unavailable', `status=${resp.status}`))
    const parsed = HenrikMatchDetail.safeParse(resp.json)
    if (!parsed.success)
      return err(providerError('henrik', 'bad_response', parsed.error.message))
    return ok(toMatchDetail(parsed.data, new Set(teamPuuids)))
  }
}

const toMatchDetail = (
  raw: HenrikMatchDetailType,
  ourPuuids: Set<string>,
): MatchDetail => {
  const ourTeamId =
    raw.data.players.find((p) => ourPuuids.has(p.puuid))?.team_id ??
    raw.data.teams[0]?.team_id ??
    'Red'
  const us = raw.data.teams.find((t) => t.team_id === ourTeamId)
  const them = raw.data.teams.find((t) => t.team_id !== ourTeamId)
  const usWon = us?.won === true
  const themWon = them?.won === true
  const result: MatchDetail['result'] =
    usWon && !themWon ? 'win' : !usWon && themWon ? 'loss' : 'draw'

  const scoreboard: ScoreboardRow[] = raw.data.players.map((p) => {
    const totalShots = p.stats.headshots + p.stats.bodyshots + p.stats.legshots
    const hsPct = totalShots > 0 ? (p.stats.headshots / totalShots) * 100 : 0
    return {
      puuid: p.puuid,
      riotName: p.name,
      riotTag: p.tag,
      agent: p.agent.name,
      kills: p.stats.kills,
      deaths: p.stats.deaths,
      assists: p.stats.assists,
      adr: 0,
      hsPct: Number(hsPct.toFixed(1)),
    }
  })

  return {
    matchId: raw.data.metadata.match_id,
    seasonId: raw.data.metadata.season?.id ?? null,
    playedAt: Date.parse(raw.data.metadata.started_at),
    map: raw.data.metadata.map.name,
    result,
    scoreUs: us?.rounds.won ?? 0,
    scoreThem: them?.rounds.won ?? 0,
    ourPuuids: new Set(
      raw.data.players.filter((p) => p.team_id === ourTeamId).map((p) => p.puuid),
    ),
    scoreboard,
    raw,
  }
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm test src/adapters/henrik/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/henrik/ tests/fixtures/henrik/
git commit -m "feat(henrik): MatchDataProvider implementation against fixtures"
```

---

## Milestone 6 — Discord shell

### Task 19: Discord client factory

**Files:**
- Create: `src/adapters/discord/client.ts`

- [ ] **Step 1: Implement client factory**

```ts
import { Client, GatewayIntentBits, Partials } from 'discord.js'

export const createDiscordClient = (): Client =>
  new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  })
```

- [ ] **Step 2: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/adapters/discord/client.ts
git commit -m "feat(discord): client factory (Guilds intent only)"
```

---

### Task 20: Command framework — types + permission resolver

**Files:**
- Create: `src/adapters/discord/command.ts`
- Create: `src/adapters/discord/permission.ts`
- Create: `src/adapters/discord/permission.test.ts`

- [ ] **Step 1: Define command type**

`src/adapters/discord/command.ts`:

```ts
import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'
import type { Logger } from '../../lib/logger.js'

export type CommandPermission = 'captain' | 'member' | 'anyone'

export type CommandContext = {
  logger: Logger
}

export type SlashCommand = {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
  permission: CommandPermission
  execute: (interaction: ChatInputCommandInteraction, ctx: CommandContext) => Promise<void>
}
```

- [ ] **Step 2: Write the failing test for permission resolver**

`src/adapters/discord/permission.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TeamRecord } from '../../ports/repositories.js'
import { canRunCommand } from './permission.js'

const team: TeamRecord = {
  guildId: 'g1',
  henrikTeamId: null,
  region: null,
  captainRoleId: 'r-cap',
  memberRoleId: 'r-mem',
  announcementsChannelId: null,
  createdAt: 0,
}

describe('canRunCommand', () => {
  it('always allows anyone-perm commands', () => {
    expect(canRunCommand('anyone', { team, userRoleIds: [], isAdmin: false })).toBe(true)
  })

  it('allows admins to run anything', () => {
    expect(canRunCommand('captain', { team, userRoleIds: [], isAdmin: true })).toBe(true)
  })

  it('allows captain-role users to run captain commands', () => {
    expect(
      canRunCommand('captain', { team, userRoleIds: ['r-cap'], isAdmin: false }),
    ).toBe(true)
  })

  it('rejects non-captain users from captain commands', () => {
    expect(
      canRunCommand('captain', { team, userRoleIds: ['r-mem'], isAdmin: false }),
    ).toBe(false)
  })

  it('allows member-role users to run member commands', () => {
    expect(canRunCommand('member', { team, userRoleIds: ['r-mem'], isAdmin: false })).toBe(
      true,
    )
  })

  it('captain-role users can also run member commands', () => {
    expect(canRunCommand('member', { team, userRoleIds: ['r-cap'], isAdmin: false })).toBe(
      true,
    )
  })

  it('rejects when team has no role configured and user is not admin', () => {
    const t = { ...team, captainRoleId: null, memberRoleId: null }
    expect(canRunCommand('member', { team: t, userRoleIds: [], isAdmin: false })).toBe(false)
  })
})
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm test src/adapters/discord/permission.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement canRunCommand**

`src/adapters/discord/permission.ts`:

```ts
import type { TeamRecord } from '../../ports/repositories.js'
import type { CommandPermission } from './command.js'

export type PermissionContext = {
  team: TeamRecord | null
  userRoleIds: string[]
  isAdmin: boolean
}

export const canRunCommand = (
  required: CommandPermission,
  ctx: PermissionContext,
): boolean => {
  if (required === 'anyone') return true
  if (ctx.isAdmin) return true
  if (!ctx.team) return false
  if (required === 'captain') {
    return ctx.team.captainRoleId !== null && ctx.userRoleIds.includes(ctx.team.captainRoleId)
  }
  // member: captain-role users implicitly count as members
  if (
    ctx.team.captainRoleId !== null &&
    ctx.userRoleIds.includes(ctx.team.captainRoleId)
  )
    return true
  return ctx.team.memberRoleId !== null && ctx.userRoleIds.includes(ctx.team.memberRoleId)
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm test src/adapters/discord/permission.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/discord/command.ts src/adapters/discord/permission.ts src/adapters/discord/permission.test.ts
git commit -m "feat(discord): command type + permission resolver"
```

---

### Task 21: Command registry + interaction router

**Files:**
- Create: `src/adapters/discord/registry.ts`
- Create: `src/adapters/discord/router.ts`
- Create: `src/adapters/discord/router.test.ts`

- [ ] **Step 1: Implement registry**

`src/adapters/discord/registry.ts`:

```ts
import type { SlashCommand } from './command.js'

export type CommandRegistry = Map<string, SlashCommand>

export const buildRegistry = (commands: SlashCommand[]): CommandRegistry => {
  const m = new Map<string, SlashCommand>()
  for (const c of commands) {
    if (m.has(c.data.name)) throw new Error(`duplicate command: ${c.data.name}`)
    m.set(c.data.name, c)
  }
  return m
}
```

- [ ] **Step 2: Write the failing test for the router**

`src/adapters/discord/router.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../lib/logger.js'
import type { TeamRepository } from '../../ports/repositories.js'
import type { CommandContext, SlashCommand } from './command.js'
import { buildRegistry } from './registry.js'
import { routeInteraction } from './router.js'

const noopLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Logger

const okTeamRepo = {
  findByGuild: () => ({ _tag: 'ok' as const, value: null }),
} as unknown as TeamRepository

const fakeInteraction = (overrides: Record<string, unknown> = {}) => {
  const reply = vi.fn().mockResolvedValue(undefined)
  return {
    isChatInputCommand: () => true,
    commandName: 'help',
    guildId: 'g1',
    member: { permissions: { has: () => true }, roles: { cache: new Map() } },
    reply,
    deferReply: vi.fn(),
    editReply: vi.fn(),
    ...overrides,
  } as never
}

describe('routeInteraction', () => {
  it('runs the matching command', async () => {
    const exec = vi.fn().mockResolvedValue(undefined)
    const cmd: SlashCommand = {
      data: { name: 'help', toJSON: () => ({}) } as unknown as SlashCommand['data'],
      permission: 'anyone',
      execute: exec,
    }
    const registry = buildRegistry([cmd])
    await routeInteraction(fakeInteraction(), {
      registry,
      teamRepo: okTeamRepo,
      ctx: { logger: noopLogger } satisfies CommandContext,
    })
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('replies with permission-denied for unauthorized user', async () => {
    const exec = vi.fn()
    const cmd: SlashCommand = {
      data: { name: 'team', toJSON: () => ({}) } as unknown as SlashCommand['data'],
      permission: 'captain',
      execute: exec,
    }
    const registry = buildRegistry([cmd])
    const i = fakeInteraction({
      commandName: 'team',
      member: { permissions: { has: () => false }, roles: { cache: new Map() } },
    })
    await routeInteraction(i, {
      registry,
      teamRepo: okTeamRepo,
      ctx: { logger: noopLogger } satisfies CommandContext,
    })
    expect(exec).not.toHaveBeenCalled()
    expect((i as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    )
  })
})
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm test src/adapters/discord/router.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement router**

`src/adapters/discord/router.ts`:

```ts
import { type ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import type { TeamRepository } from '../../ports/repositories.js'
import type { CommandContext } from './command.js'
import { canRunCommand } from './permission.js'
import type { CommandRegistry } from './registry.js'

export type RouterDeps = {
  registry: CommandRegistry
  teamRepo: TeamRepository
  ctx: CommandContext
}

export const routeInteraction = async (
  interaction: ChatInputCommandInteraction,
  deps: RouterDeps,
): Promise<void> => {
  if (!interaction.isChatInputCommand()) return
  const cmd = deps.registry.get(interaction.commandName)
  if (!cmd) return

  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.reply({ content: 'This bot only works in servers.', ephemeral: true })
    return
  }

  const teamResult = deps.teamRepo.findByGuild(guildId)
  const team = teamResult._tag === 'ok' ? teamResult.value : null

  const member = interaction.member as {
    permissions?: { has: (p: bigint) => boolean }
    roles?: { cache: Map<string, unknown> }
  } | null
  const isAdmin = member?.permissions?.has?.(PermissionFlagsBits.Administrator) === true
  const userRoleIds = Array.from(member?.roles?.cache?.keys() ?? [])

  if (!canRunCommand(cmd.permission, { team, userRoleIds, isAdmin })) {
    await interaction.reply({
      content: `You don't have permission to run \`/${interaction.commandName}\`. Required: ${cmd.permission}.`,
      ephemeral: true,
    })
    return
  }

  try {
    await cmd.execute(interaction, deps.ctx)
  } catch (e) {
    deps.ctx.logger.error({ err: e, command: interaction.commandName }, 'command execution failed')
    const msg = 'Something went wrong running that command. Please try again.'
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: msg })
    } else {
      await interaction.reply({ content: msg, ephemeral: true })
    }
  }
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm test src/adapters/discord/router.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/discord/registry.ts src/adapters/discord/router.ts src/adapters/discord/router.test.ts
git commit -m "feat(discord): command registry + interaction router with perm gate"
```

---

### Task 22: /help command + register-commands script

**Files:**
- Create: `src/adapters/discord/commands/help.ts`
- Create: `scripts/register-commands.ts`

- [ ] **Step 1: Implement /help**

```ts
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
```

- [ ] **Step 2: Implement register-commands script**

`scripts/register-commands.ts`:

```ts
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
```

- [ ] **Step 3: Create commands index**

`src/adapters/discord/commands/index.ts`:

```ts
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'

export const allCommands = (): SlashCommand[] => [helpCommand]
```

- [ ] **Step 4: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/discord/commands/ scripts/register-commands.ts
git commit -m "feat(discord): /help command + register-commands script"
```

---

## Milestone 7 — Team config commands

### Task 23: setTeamConfig use case

**Files:**
- Create: `src/app/setTeamConfig.ts`
- Create: `src/app/setTeamConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { TeamRecord, TeamRepository } from '../ports/repositories.js'
import { setTeamConfig } from './setTeamConfig.js'

const fakeRepo = (): TeamRepository => ({
  findByGuild: vi.fn().mockReturnValue(ok(null)),
  upsert: vi.fn((p) =>
    ok({
      guildId: p.guildId,
      henrikTeamId: p.henrikTeamId ?? null,
      region: p.region ?? null,
      captainRoleId: p.captainRoleId ?? null,
      memberRoleId: p.memberRoleId ?? null,
      announcementsChannelId: p.announcementsChannelId ?? null,
      createdAt: 0,
    } satisfies TeamRecord),
  ),
})

describe('setTeamConfig', () => {
  it('rejects an unknown region', () => {
    const r = setTeamConfig(fakeRepo(), { guildId: 'g1', region: 'mars' })
    if (isErr(r)) {
      expect(r.error.tag).toBe('validation')
      if (r.error.tag === 'validation') expect(r.error.field).toBe('region')
    } else throw new Error('expected err')
  })

  it('upserts a valid region', () => {
    const repo = fakeRepo()
    const r = setTeamConfig(repo, { guildId: 'g1', region: 'NA' })
    if (isOk(r)) expect(r.value.region).toBe('na')
    else throw new Error('expected ok')
  })

  it('passes through role + channel ids unchanged', () => {
    const repo = fakeRepo()
    const r = setTeamConfig(repo, {
      guildId: 'g1',
      captainRoleId: 'role-1',
      announcementsChannelId: 'ch-1',
    })
    if (isOk(r)) {
      expect(r.value.captainRoleId).toBe('role-1')
      expect(r.value.announcementsChannelId).toBe('ch-1')
    } else throw new Error('expected ok')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/app/setTeamConfig.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement setTeamConfig**

```ts
import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { type Result, err, isErr } from '../domain/result.js'
import type { TeamRecord, TeamRepository } from '../ports/repositories.js'

const REGIONS = new Set(['na', 'eu', 'ap', 'kr', 'latam', 'br'])
const CONFERENCE_RE = /^[A-Z]+(_[A-Z]+)+$/   // e.g. NA_US_WEST, NA_US_EAST, NA_SUPER, EU_TURKEY

export type SetTeamConfigInput = {
  guildId: string
  region?: string
  conference?: string
  henrikTeamId?: string
  captainRoleId?: string
  memberRoleId?: string
  announcementsChannelId?: string
}

export const setTeamConfig = (
  repo: TeamRepository,
  input: SetTeamConfigInput,
): Result<TeamRecord, DomainError> => {
  const patch: Partial<TeamRecord> & { guildId: string } = { guildId: input.guildId }
  if (input.region !== undefined) {
    const lower = input.region.toLowerCase()
    if (!REGIONS.has(lower))
      return err(validation('region', `must be one of ${[...REGIONS].join(', ')}`))
    patch.region = lower
  }
  if (input.conference !== undefined) {
    const upper = input.conference.toUpperCase()
    if (!CONFERENCE_RE.test(upper))
      return err(validation('conference', 'must be a Premier conference id like NA_US_WEST'))
    patch.conference = upper
  }
  if (input.henrikTeamId !== undefined) patch.henrikTeamId = input.henrikTeamId
  if (input.captainRoleId !== undefined) patch.captainRoleId = input.captainRoleId
  if (input.memberRoleId !== undefined) patch.memberRoleId = input.memberRoleId
  if (input.announcementsChannelId !== undefined)
    patch.announcementsChannelId = input.announcementsChannelId

  const r = repo.upsert(patch)
  if (isErr(r)) return r
  return r
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/app/setTeamConfig.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/setTeamConfig.ts src/app/setTeamConfig.test.ts
git commit -m "feat(app): setTeamConfig use case with region validation"
```

---

### Task 24: /team command (set + show)

**Files:**
- Create: `src/adapters/discord/commands/team.ts`
- Modify: `src/adapters/discord/commands/index.ts`

- [ ] **Step 1: Implement /team**

```ts
import { SlashCommandBuilder } from 'discord.js'
import { setTeamConfig } from '../../../app/setTeamConfig.js'
import { isErr } from '../../../domain/result.js'
import type { TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const teamCommand = (teamRepo: TeamRepository): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage team configuration (captain only).')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set a team config value.')
        .addStringOption((o) =>
          o
            .setName('field')
            .setDescription('Which field to set.')
            .setRequired(true)
            .addChoices(
              { name: 'region', value: 'region' },
              { name: 'conference', value: 'conference' },
              { name: 'henrik-team-id', value: 'henrik_team_id' },
              { name: 'captain-role', value: 'captain_role' },
              { name: 'member-role', value: 'member_role' },
              { name: 'channel', value: 'channel' },
            ),
        )
        .addStringOption((o) =>
          o.setName('string-value').setDescription('Plain string value.'),
        )
        .addRoleOption((o) =>
          o.setName('role-value').setDescription('Role value (for role fields).'),
        )
        .addChannelOption((o) =>
          o.setName('channel-value').setDescription('Channel value (for channel field).'),
        ),
    )
    .addSubcommand((s) =>
      s.setName('show').setDescription('Show the current team configuration.'),
    ) as unknown as SlashCommandBuilder,
  permission: 'captain',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'show') {
      const t = teamRepo.findByGuild(interaction.guildId)
      if (isErr(t) || !t.value) {
        await interaction.reply({
          ephemeral: true,
          content: 'No team config yet. Use `/team set` to configure.',
        })
        return
      }
      const v = t.value
      await interaction.reply({
        ephemeral: true,
        content:
          `**Team config**\n` +
          `region: ${v.region ?? '(unset)'}\n` +
          `henrik_team_id: ${v.henrikTeamId ?? '(unset)'}\n` +
          `captain role: ${v.captainRoleId ? `<@&${v.captainRoleId}>` : '(unset)'}\n` +
          `member role: ${v.memberRoleId ? `<@&${v.memberRoleId}>` : '(unset)'}\n` +
          `announcements channel: ${v.announcementsChannelId ? `<#${v.announcementsChannelId}>` : '(unset)'}`,
      })
      return
    }

    const field = interaction.options.getString('field', true)
    const stringValue = interaction.options.getString('string-value')
    const roleValue = interaction.options.getRole('role-value')
    const channelValue = interaction.options.getChannel('channel-value')

    const input: Parameters<typeof setTeamConfig>[1] = { guildId: interaction.guildId }
    switch (field) {
      case 'region':
        if (!stringValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide string-value (region).' })
          return
        }
        input.region = stringValue
        break
      case 'conference':
        if (!stringValue) {
          await interaction.reply({
            ephemeral: true,
            content: 'Provide string-value (e.g. NA_US_WEST).',
          })
          return
        }
        input.conference = stringValue
        break
      case 'henrik_team_id':
        if (!stringValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide string-value.' })
          return
        }
        input.henrikTeamId = stringValue
        break
      case 'captain_role':
        if (!roleValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide role-value.' })
          return
        }
        input.captainRoleId = roleValue.id
        break
      case 'member_role':
        if (!roleValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide role-value.' })
          return
        }
        input.memberRoleId = roleValue.id
        break
      case 'channel':
        if (!channelValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide channel-value.' })
          return
        }
        input.announcementsChannelId = channelValue.id
        break
    }

    const r = setTeamConfig(teamRepo, input)
    if (isErr(r)) {
      const msg =
        r.error.tag === 'validation' ? `Invalid: ${r.error.message}` : 'Failed to update.'
      await interaction.reply({ ephemeral: true, content: msg })
      return
    }
    await interaction.reply({ ephemeral: true, content: `Updated \`${field}\`.` })
  },
})
```

- [ ] **Step 2: Wire into commands index**

Replace `src/adapters/discord/commands/index.ts`:

```ts
import type { TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
]
```

- [ ] **Step 3: Update register-commands script for new signature**

Replace `scripts/register-commands.ts`:

```ts
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
```

- [ ] **Step 4: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/discord/commands/team.ts src/adapters/discord/commands/index.ts scripts/register-commands.ts
git commit -m "feat(discord): /team set + /team show commands"
```

---

## Milestone 8 — Roster + linking

### Task 25: linkPlayer use case

**Files:**
- Create: `src/app/linkPlayer.ts`
- Create: `src/app/linkPlayer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type { PlayerRepository } from '../ports/repositories.js'
import { linkPlayer, parseRiotTag } from './linkPlayer.js'

describe('parseRiotTag', () => {
  it('splits Name#TAG', () => {
    const r = parseRiotTag('Captain#NA1')
    if (isOk(r)) expect(r.value).toEqual({ name: 'Captain', tag: 'NA1' })
    else throw new Error('expected ok')
  })

  it('rejects missing #', () => {
    expect(isErr(parseRiotTag('CaptainNA1'))).toBe(true)
  })

  it('rejects empty parts', () => {
    expect(isErr(parseRiotTag('#NA1'))).toBe(true)
    expect(isErr(parseRiotTag('Captain#'))).toBe(true)
  })
})

describe('linkPlayer', () => {
  const fakeProvider = (): MatchDataProvider =>
    ({
      resolveAccount: vi.fn().mockResolvedValue(ok({ puuid: 'PU-1', region: 'na' })),
    }) as unknown as MatchDataProvider

  const fakePlayerRepo = (): PlayerRepository =>
    ({ upsert: vi.fn().mockReturnValue(ok({ puuid: 'PU-1' })) }) as unknown as PlayerRepository

  it('verifies via provider then upserts the player', async () => {
    const p = fakeProvider()
    const repo = fakePlayerRepo()
    const r = await linkPlayer({
      provider: p,
      playerRepo: repo,
      input: { guildId: 'g1', discordId: 'u1', riotTag: 'Captain#NA1', addedBy: 'self' },
    })
    expect(isOk(r)).toBe(true)
    expect(p.resolveAccount).toHaveBeenCalledWith('Captain', 'NA1')
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ puuid: 'PU-1', riotName: 'Captain', riotTag: 'NA1' }),
    )
  })

  it('propagates provider errors', async () => {
    const p = {
      resolveAccount: vi
        .fn()
        .mockResolvedValue({ _tag: 'err' as const, error: { tag: 'provider_error' } }),
    } as unknown as MatchDataProvider
    const r = await linkPlayer({
      provider: p,
      playerRepo: fakePlayerRepo(),
      input: { guildId: 'g1', discordId: 'u1', riotTag: 'Captain#NA1', addedBy: 'self' },
    })
    expect(isErr(r)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/app/linkPlayer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement linkPlayer**

```ts
import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type { PlayerRecord, PlayerRepository } from '../ports/repositories.js'

export const parseRiotTag = (raw: string): Result<{ name: string; tag: string }, DomainError> => {
  const idx = raw.indexOf('#')
  if (idx <= 0 || idx === raw.length - 1)
    return err(validation('riot_tag', 'expected Name#TAG'))
  return ok({ name: raw.slice(0, idx), tag: raw.slice(idx + 1) })
}

export type LinkPlayerInput = {
  guildId: string
  discordId: string
  riotTag: string
  addedBy: string
}

export type LinkPlayerDeps = {
  provider: MatchDataProvider
  playerRepo: PlayerRepository
  input: LinkPlayerInput
}

export const linkPlayer = async (
  deps: LinkPlayerDeps,
): Promise<Result<PlayerRecord, DomainError>> => {
  const parsed = parseRiotTag(deps.input.riotTag)
  if (isErr(parsed)) return parsed
  const resolved = await deps.provider.resolveAccount(parsed.value.name, parsed.value.tag)
  if (isErr(resolved)) return resolved
  return deps.playerRepo.upsert({
    guildId: deps.input.guildId,
    discordId: deps.input.discordId,
    riotName: parsed.value.name,
    riotTag: parsed.value.tag,
    puuid: resolved.value.puuid,
    role: null,
    addedBy: deps.input.addedBy,
  })
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/app/linkPlayer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/linkPlayer.ts src/app/linkPlayer.test.ts
git commit -m "feat(app): linkPlayer use case + Riot#TAG parser"
```

---

### Task 26: /link and /unlink commands

**Files:**
- Create: `src/adapters/discord/commands/link.ts`
- Modify: `src/adapters/discord/commands/index.ts`

- [ ] **Step 1: Implement /link and /unlink**

```ts
import { SlashCommandBuilder } from 'discord.js'
import { linkPlayer } from '../../../app/linkPlayer.js'
import { isErr } from '../../../domain/result.js'
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const linkCommand = (
  provider: MatchDataProvider,
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Riot account (Name#TAG). Your captain still assigns your role.')
    .addStringOption((o) =>
      o.setName('riot-id').setDescription('Your Riot ID, e.g. Captain#NA1').setRequired(true),
    ),
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    await interaction.deferReply({ ephemeral: true })
    const riotTag = interaction.options.getString('riot-id', true)
    const r = await linkPlayer({
      provider,
      playerRepo,
      input: {
        guildId: interaction.guildId,
        discordId: interaction.user.id,
        riotTag,
        addedBy: 'self',
      },
    })
    if (isErr(r)) {
      const msg =
        r.error.tag === 'validation'
          ? `Invalid Riot ID: ${r.error.message}`
          : r.error.tag === 'conflict'
            ? r.error.message
            : 'Could not link your account. Try again later.'
      await interaction.editReply({ content: msg })
      return
    }
    await interaction.editReply({
      content: `Linked **${r.value.riotName}#${r.value.riotTag}**. Your captain still needs to assign your in-game role with \`/roster set-role\`.`,
    })
  },
})

export const unlinkCommand = (playerRepo: PlayerRepository): SlashCommand => ({
  data: new SlashCommandBuilder().setName('unlink').setDescription('Unlink your Riot account.'),
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const r = playerRepo.remove(interaction.guildId, interaction.user.id)
    await interaction.reply({
      ephemeral: true,
      content: isErr(r) ? 'Failed to unlink.' : 'Unlinked.',
    })
  },
})
```

- [ ] **Step 2: Wire into commands index**

Replace `src/adapters/discord/commands/index.ts`:

```ts
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository, TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  provider: MatchDataProvider
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
]
```

- [ ] **Step 3: Update register-commands**

Add to `scripts/register-commands.ts` between `openDb` and `allCommands`:

```ts
import { SqlitePlayerRepository } from '../src/adapters/sqlite/playerRepo.js'
import { HenrikClient } from '../src/adapters/henrik/client.js'

const playerRepo = new SqlitePlayerRepository(db)
const provider = new HenrikClient({ apiKey: env.HENRIK_API_KEY })
```

And update the `allCommands` call:

```ts
const body = allCommands({ teamRepo, playerRepo, provider }).map((c) => c.data.toJSON())
```

- [ ] **Step 4: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/discord/commands/link.ts src/adapters/discord/commands/index.ts scripts/register-commands.ts
git commit -m "feat(discord): /link + /unlink commands"
```

---

### Task 27: /roster command (add / remove / set-role)

**Files:**
- Create: `src/app/setPlayerRole.ts`
- Create: `src/app/setPlayerRole.test.ts`
- Create: `src/adapters/discord/commands/roster.ts`
- Modify: `src/adapters/discord/commands/index.ts`

- [ ] **Step 1: Write the failing test for setPlayerRole**

```ts
import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { PlayerRepository } from '../ports/repositories.js'
import { ROLES, setPlayerRole } from './setPlayerRole.js'

describe('setPlayerRole', () => {
  it('rejects unknown roles', () => {
    const repo = { setRole: vi.fn() } as unknown as PlayerRepository
    const r = setPlayerRole(repo, 'g1', 'u1', 'sniper')
    if (isErr(r)) {
      expect(r.error.tag).toBe('validation')
      if (r.error.tag === 'validation') expect(r.error.field).toBe('role')
    } else throw new Error('expected err')
  })

  it('accepts a valid role and forwards to repo', () => {
    const repo = { setRole: vi.fn().mockReturnValue(ok(undefined)) } as unknown as PlayerRepository
    const r = setPlayerRole(repo, 'g1', 'u1', 'duelist')
    expect(isOk(r)).toBe(true)
    expect(repo.setRole).toHaveBeenCalledWith('g1', 'u1', 'duelist')
  })

  it('exports the canonical role list', () => {
    expect(ROLES).toEqual(['duelist', 'initiator', 'controller', 'sentinel', 'flex'])
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/app/setPlayerRole.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement setPlayerRole**

```ts
import type { DomainError } from '../domain/errors.js'
import { validation } from '../domain/errors.js'
import { type Result, err } from '../domain/result.js'
import type { PlayerRepository } from '../ports/repositories.js'

export const ROLES = ['duelist', 'initiator', 'controller', 'sentinel', 'flex'] as const
export type Role = (typeof ROLES)[number]

export const setPlayerRole = (
  repo: PlayerRepository,
  guildId: string,
  discordId: string,
  role: string,
): Result<void, DomainError> => {
  const lower = role.toLowerCase() as Role
  if (!ROLES.includes(lower))
    return err(validation('role', `must be one of ${ROLES.join(', ')}`))
  return repo.setRole(guildId, discordId, lower)
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/app/setPlayerRole.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement /roster command**

```ts
import { SlashCommandBuilder } from 'discord.js'
import { linkPlayer } from '../../../app/linkPlayer.js'
import { ROLES, setPlayerRole } from '../../../app/setPlayerRole.js'
import { isErr } from '../../../domain/result.js'
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const rosterCommand = (
  provider: MatchDataProvider,
  playerRepo: PlayerRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Manage the team roster (captain only).')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add or update a player.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true))
        .addStringOption((o) =>
          o.setName('riot-id').setDescription('Name#TAG').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('role')
            .setDescription('In-game role')
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a player from the roster.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('set-role')
        .setDescription('Assign a player\'s in-game role.')
        .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('role')
            .setDescription('In-game role')
            .setRequired(true)
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        ),
    ) as unknown as SlashCommandBuilder,
  permission: 'captain',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()
    const user = interaction.options.getUser('user', true)

    if (sub === 'remove') {
      const r = playerRepo.remove(interaction.guildId, user.id)
      await interaction.reply({
        ephemeral: true,
        content: isErr(r) ? 'Failed.' : `Removed <@${user.id}>.`,
      })
      return
    }

    if (sub === 'set-role') {
      const role = interaction.options.getString('role', true)
      const r = setPlayerRole(playerRepo, interaction.guildId, user.id, role)
      await interaction.reply({
        ephemeral: true,
        content: isErr(r)
          ? r.error.tag === 'validation'
            ? r.error.message
            : 'Failed.'
          : `Set <@${user.id}> role to **${role}**.`,
      })
      return
    }

    // add
    await interaction.deferReply({ ephemeral: true })
    const riotTag = interaction.options.getString('riot-id', true)
    const linked = await linkPlayer({
      provider,
      playerRepo,
      input: {
        guildId: interaction.guildId,
        discordId: user.id,
        riotTag,
        addedBy: interaction.user.id,
      },
    })
    if (isErr(linked)) {
      await interaction.editReply({
        content:
          linked.error.tag === 'validation'
            ? linked.error.message
            : linked.error.tag === 'conflict'
              ? linked.error.message
              : 'Failed to add player.',
      })
      return
    }
    const role = interaction.options.getString('role')
    if (role) {
      const rr = setPlayerRole(playerRepo, interaction.guildId, user.id, role)
      if (isErr(rr)) {
        await interaction.editReply({
          content: `Linked but role rejected: ${rr.error.tag === 'validation' ? rr.error.message : 'unknown'}`,
        })
        return
      }
    }
    await interaction.editReply({
      content: `Added <@${user.id}> as **${linked.value.riotName}#${linked.value.riotTag}**${
        role ? ` (${role})` : ''
      }.`,
    })
  },
})
```

- [ ] **Step 6: Wire into index**

Replace `allCommands` in `src/adapters/discord/commands/index.ts`:

```ts
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type { PlayerRepository, TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { rosterCommand } from './roster.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  provider: MatchDataProvider
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
  rosterCommand(deps.provider, deps.playerRepo),
]
```

- [ ] **Step 7: Verify compile + test**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: 0 errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/setPlayerRole.ts src/app/setPlayerRole.test.ts src/adapters/discord/commands/roster.ts src/adapters/discord/commands/index.ts
git commit -m "feat(discord): /roster add/remove/set-role (captain only)"
```

---

## Milestone 9 — Job queue + worker

### Task 28: Job worker loop

**Files:**
- Create: `src/jobs/worker.ts`
- Create: `src/jobs/worker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { ok } from '../domain/result.js'
import type { JobRecord, JobRepository } from '../ports/repositories.js'
import { type JobHandler, runOnce } from './worker.js'

const makeRepo = (jobs: JobRecord[]): JobRepository => {
  let i = 0
  return {
    enqueue: vi.fn().mockReturnValue(ok(0)),
    claimNext: vi.fn().mockImplementation(() => ok(jobs[i++] ?? null)),
    markDone: vi.fn().mockReturnValue(ok(undefined)),
    markFailed: vi.fn().mockReturnValue(ok(undefined)),
  }
}

describe('runOnce', () => {
  it('dispatches jobs to handlers and marks done on success', async () => {
    const job: JobRecord = {
      id: 1,
      kind: 'echo',
      payloadJson: '{"x":1}',
      runAt: 0,
      attempts: 1,
      lastError: null,
      status: 'running',
    }
    const repo = makeRepo([job])
    const handler: JobHandler = vi.fn().mockResolvedValue(undefined)
    const handlers = new Map([['echo', handler]])
    await runOnce({ repo, handlers, maxJobs: 1, now: 100 })
    expect(handler).toHaveBeenCalledWith({ x: 1 })
    expect(repo.markDone).toHaveBeenCalledWith(1)
  })

  it('marks failed with backoff on handler throw, then sets failed after max attempts', async () => {
    const repo = makeRepo([
      {
        id: 2,
        kind: 'boom',
        payloadJson: '{}',
        runAt: 0,
        attempts: 1,
        lastError: null,
        status: 'running',
      },
    ])
    const handlers = new Map<string, JobHandler>([['boom', () => Promise.reject(new Error('x'))]])
    await runOnce({ repo, handlers, maxJobs: 1, now: 100, maxAttempts: 5 })
    expect(repo.markFailed).toHaveBeenCalledWith(2, 'x', expect.any(Number))

    const repo2 = makeRepo([
      {
        id: 3,
        kind: 'boom',
        payloadJson: '{}',
        runAt: 0,
        attempts: 5,
        lastError: 'x',
        status: 'running',
      },
    ])
    await runOnce({ repo: repo2, handlers, maxJobs: 1, now: 100, maxAttempts: 5 })
    expect(repo2.markFailed).toHaveBeenCalledWith(3, 'x', null)
  })

  it('logs and skips when handler kind is unknown', async () => {
    const repo = makeRepo([
      {
        id: 4,
        kind: 'unknown',
        payloadJson: '{}',
        runAt: 0,
        attempts: 1,
        lastError: null,
        status: 'running',
      },
    ])
    await runOnce({ repo, handlers: new Map(), maxJobs: 1, now: 100 })
    expect(repo.markFailed).toHaveBeenCalledWith(4, 'unknown handler: unknown', null)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/jobs/worker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement runOnce + worker loop**

```ts
import type { JobRepository } from '../ports/repositories.js'

export type JobHandler = (payload: unknown) => Promise<void>

export type RunOnceOpts = {
  repo: JobRepository
  handlers: Map<string, JobHandler>
  maxJobs: number
  now: number
  maxAttempts?: number
  baseBackoffMs?: number
}

const BACKOFF_MS = [5_000, 30_000, 300_000, 1_800_000]

export const runOnce = async (opts: RunOnceOpts): Promise<number> => {
  const max = opts.maxAttempts ?? 5
  let processed = 0
  for (let i = 0; i < opts.maxJobs; i++) {
    const claim = opts.repo.claimNext(opts.now)
    if (claim._tag === 'err' || claim.value === null) return processed
    const job = claim.value
    const handler = opts.handlers.get(job.kind)
    if (!handler) {
      opts.repo.markFailed(job.id, `unknown handler: ${job.kind}`, null)
      processed++
      continue
    }
    try {
      const payload = JSON.parse(job.payloadJson) as unknown
      await handler(payload)
      opts.repo.markDone(job.id)
    } catch (e) {
      const message = (e as Error).message
      if (job.attempts >= max) {
        opts.repo.markFailed(job.id, message, null)
      } else {
        const backoff = BACKOFF_MS[job.attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 60_000
        opts.repo.markFailed(job.id, message, opts.now + backoff)
      }
    }
    processed++
  }
  return processed
}

export type StartWorkerOpts = Omit<RunOnceOpts, 'now'> & {
  pollIntervalMs?: number
  signal: AbortSignal
}

export const startWorker = async (opts: StartWorkerOpts): Promise<void> => {
  const interval = opts.pollIntervalMs ?? 2_000
  while (!opts.signal.aborted) {
    await runOnce({ ...opts, now: Date.now() })
    await new Promise((r) => setTimeout(r, interval))
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/jobs/worker.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/jobs/worker.ts src/jobs/worker.test.ts
git commit -m "feat(jobs): runOnce + startWorker with backoff + max attempts"
```

---

## Milestone 10 — Match ingestion

### Task 29: Stats embed builder

**Files:**
- Create: `src/adapters/discord/embeds/matchEmbed.ts`
- Create: `src/adapters/discord/embeds/matchEmbed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { MatchDetail } from '../../../ports/matchData.js'
import { buildMatchEmbed } from './matchEmbed.js'

const sample: MatchDetail = {
  matchId: 'M-1',
  seasonId: null,
  playedAt: 0,
  map: 'Ascent',
  result: 'win',
  scoreUs: 13,
  scoreThem: 9,
  ourPuuids: new Set(['p1']),
  scoreboard: [
    {
      puuid: 'p1',
      riotName: 'Cap',
      riotTag: 'NA1',
      agent: 'Omen',
      kills: 20,
      deaths: 12,
      assists: 6,
      adr: 0,
      hsPct: 28.5,
    },
  ],
  raw: {},
}

describe('buildMatchEmbed', () => {
  it('puts the map and score in the title and an our-team scoreboard in the description', () => {
    const e = buildMatchEmbed(sample)
    expect(e.title).toContain('Ascent')
    expect(e.title).toContain('13-9')
    expect(e.title?.toLowerCase()).toContain('win')
    expect(e.description).toContain('Cap#NA1')
    expect(e.description).toContain('Omen')
    expect(e.description).toContain('20/12/6')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/adapters/discord/embeds/matchEmbed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement embed builder**

```ts
import type { APIEmbed } from 'discord.js'
import type { MatchDetail } from '../../../ports/matchData.js'

const RESULT_COLOR: Record<MatchDetail['result'], number> = {
  win: 0x2ecc71,
  loss: 0xe74c3c,
  draw: 0x95a5a6,
  no_result: 0x7f8c8d,
}

export const buildMatchEmbed = (m: MatchDetail): APIEmbed => {
  const ours = m.scoreboard
    .filter((p) => m.ourPuuids.has(p.puuid))
    .sort((a, b) => b.kills - a.kills)
  const lines = ours.map(
    (p) =>
      `**${p.riotName}#${p.riotTag}** — ${p.agent} • ${p.kills}/${p.deaths}/${p.assists} • HS ${p.hsPct.toFixed(1)}%`,
  )
  return {
    title: `${m.result.toUpperCase()} — ${m.map} ${m.scoreUs}-${m.scoreThem}`,
    description: lines.join('\n') || '_no scoreboard data_',
    color: RESULT_COLOR[m.result],
    timestamp: new Date(m.playedAt).toISOString(),
    footer: { text: `match ${m.matchId}` },
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/adapters/discord/embeds/matchEmbed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/discord/embeds/matchEmbed.ts src/adapters/discord/embeds/matchEmbed.test.ts
git commit -m "feat(discord): match stats embed builder"
```

---

### Task 30: ingestMatch use case + Discord poster port

**Files:**
- Create: `src/ports/announcer.ts`
- Create: `src/app/ingestMatch.ts`
- Create: `src/app/ingestMatch.test.ts`

- [ ] **Step 1: Define announcer port**

`src/ports/announcer.ts`:

```ts
import type { APIEmbed } from 'discord.js'
import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export interface MatchAnnouncer {
  postMatch(
    guildId: string,
    channelId: string,
    embed: APIEmbed,
    threadName: string,
  ): Promise<Result<{ threadId: string }, DomainError>>
}
```

- [ ] **Step 2: Write the failing test for ingestMatch**

```ts
import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { MatchDataProvider, MatchDetail } from '../ports/matchData.js'
import type { MatchAnnouncer } from '../ports/announcer.js'
import type {
  MatchRepository,
  PlayerRepository,
  TeamRecord,
  TeamRepository,
} from '../ports/repositories.js'
import { ingestMatch } from './ingestMatch.js'

const team: TeamRecord = {
  guildId: 'g1',
  henrikTeamId: 't-1',
  region: 'na',
  captainRoleId: null,
  memberRoleId: null,
  announcementsChannelId: 'ch-1',
  createdAt: 0,
}

const detail: MatchDetail = {
  matchId: 'M-1',
  seasonId: 'S-1',
  playedAt: 100,
  map: 'Ascent',
  result: 'win',
  scoreUs: 13,
  scoreThem: 7,
  ourPuuids: new Set(['p1']),
  scoreboard: [],
  raw: {},
}

const fakeDeps = (overrides: Partial<Parameters<typeof ingestMatch>[0]> = {}) => {
  const teamRepo = {
    findByGuild: vi.fn().mockReturnValue(ok(team)),
  } as unknown as TeamRepository
  const matchRepo = {
    findByMatchId: vi.fn().mockReturnValue(ok(null)),
    insert: vi.fn().mockReturnValue(ok(undefined)),
    setThreadId: vi.fn().mockReturnValue(ok(undefined)),
  } as unknown as MatchRepository
  const playerRepo = {
    listByGuild: vi
      .fn()
      .mockReturnValue(
        ok([{ puuid: 'p1', guildId: 'g1', discordId: 'u1', riotName: 'C', riotTag: 'NA1', role: null, addedBy: 'self', createdAt: 0 }]),
      ),
  } as unknown as PlayerRepository
  const provider = {
    getMatchDetail: vi.fn().mockResolvedValue(ok(detail)),
  } as unknown as MatchDataProvider
  const announcer = {
    postMatch: vi.fn().mockResolvedValue(ok({ threadId: 'thread-1' })),
  } as unknown as MatchAnnouncer
  return { teamRepo, matchRepo, playerRepo, provider, announcer, ...overrides }
}

describe('ingestMatch', () => {
  it('skips if match already exists', async () => {
    const deps = fakeDeps({
      matchRepo: {
        findByMatchId: vi.fn().mockReturnValue(ok({ matchId: 'M-1' })),
        insert: vi.fn(),
        setThreadId: vi.fn(),
      } as unknown as MatchRepository,
    })
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isOk(r)).toBe(true)
    expect(deps.provider.getMatchDetail).not.toHaveBeenCalled()
    expect(deps.announcer.postMatch).not.toHaveBeenCalled()
  })

  it('fetches detail, persists match, posts thread, stores threadId', async () => {
    const deps = fakeDeps()
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    if (isErr(r)) throw new Error(JSON.stringify(r.error))
    expect(deps.provider.getMatchDetail).toHaveBeenCalledWith('na', 'M-1', ['p1'])
    expect(deps.matchRepo.insert).toHaveBeenCalled()
    expect(deps.announcer.postMatch).toHaveBeenCalled()
    expect(deps.matchRepo.setThreadId).toHaveBeenCalledWith('g1', 'M-1', 'thread-1')
  })

  it('errs if team has no announcements channel', async () => {
    const deps = fakeDeps({
      teamRepo: {
        findByGuild: vi.fn().mockReturnValue(ok({ ...team, announcementsChannelId: null })),
      } as unknown as TeamRepository,
    })
    const r = await ingestMatch(deps, { guildId: 'g1', matchId: 'M-1' })
    expect(isErr(r)).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test, expect failure**

Run: `pnpm test src/app/ingestMatch.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement ingestMatch**

```ts
import type { DomainError } from '../domain/errors.js'
import { notFound, validation } from '../domain/errors.js'
import { type Result, err, isErr, ok } from '../domain/result.js'
import { buildMatchEmbed } from '../adapters/discord/embeds/matchEmbed.js'
import type { MatchAnnouncer } from '../ports/announcer.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../ports/repositories.js'

export type IngestMatchDeps = {
  teamRepo: TeamRepository
  matchRepo: MatchRepository
  playerRepo: PlayerRepository
  provider: MatchDataProvider
  announcer: MatchAnnouncer
}

export type IngestMatchInput = { guildId: string; matchId: string }

export const ingestMatch = async (
  deps: IngestMatchDeps,
  input: IngestMatchInput,
): Promise<Result<{ skipped: boolean }, DomainError>> => {
  const existing = deps.matchRepo.findByMatchId(input.guildId, input.matchId)
  if (isErr(existing)) return existing
  if (existing.value) return ok({ skipped: true })

  const team = deps.teamRepo.findByGuild(input.guildId)
  if (isErr(team)) return team
  if (!team.value) return err(notFound('team', input.guildId))
  if (!team.value.region) return err(validation('region', 'team region not configured'))
  if (!team.value.announcementsChannelId)
    return err(validation('announcements_channel', 'channel not configured'))

  const players = deps.playerRepo.listByGuild(input.guildId)
  if (isErr(players)) return players
  const teamPuuids = players.value.map((p) => p.puuid)

  const detail = await deps.provider.getMatchDetail(
    team.value.region,
    input.matchId,
    teamPuuids,
  )
  if (isErr(detail)) return detail

  const insertResult = deps.matchRepo.insert({
    guildId: input.guildId,
    matchId: detail.value.matchId,
    seasonId: detail.value.seasonId,
    playedAt: detail.value.playedAt,
    map: detail.value.map,
    result: detail.value.result,
    scoreUs: detail.value.scoreUs,
    scoreThem: detail.value.scoreThem,
    rawJson: JSON.stringify(detail.value.raw),
    threadId: null,
  })
  if (isErr(insertResult)) return insertResult

  const embed = buildMatchEmbed(detail.value)
  const threadName = `${detail.value.map} ${detail.value.result.toUpperCase()} ${detail.value.scoreUs}-${detail.value.scoreThem}`
  const post = await deps.announcer.postMatch(
    input.guildId,
    team.value.announcementsChannelId,
    embed,
    threadName,
  )
  if (isErr(post)) return post

  const setThread = deps.matchRepo.setThreadId(
    input.guildId,
    detail.value.matchId,
    post.value.threadId,
  )
  if (isErr(setThread)) return setThread

  return ok({ skipped: false })
}
```

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm test src/app/ingestMatch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ports/announcer.ts src/app/ingestMatch.ts src/app/ingestMatch.test.ts
git commit -m "feat(app): ingestMatch use case + MatchAnnouncer port"
```

---

### Task 31: Discord MatchAnnouncer adapter

**Files:**
- Create: `src/adapters/discord/announcer.ts`

- [ ] **Step 1: Implement DiscordMatchAnnouncer**

```ts
import {
  type APIEmbed,
  type Client,
  ChannelType,
  type TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js'
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { type Result, err, ok } from '../../domain/result.js'
import type { MatchAnnouncer } from '../../ports/announcer.js'

export class DiscordMatchAnnouncer implements MatchAnnouncer {
  constructor(private readonly client: Client) {}

  async postMatch(
    guildId: string,
    channelId: string,
    embed: APIEmbed,
    threadName: string,
  ): Promise<Result<{ threadId: string }, DomainError>> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || channel.type !== ChannelType.GuildText) {
        return err(providerError('discord', 'unavailable', 'announcements channel is not a text channel'))
      }
      const text = channel as TextChannel
      const message = await text.send({ embeds: [embed] })
      const thread = await message.startThread({
        name: threadName.slice(0, 100),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      })
      return ok({ threadId: thread.id })
    } catch (e) {
      return err(providerError('discord', 'unknown', (e as Error).message))
    }
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/adapters/discord/announcer.ts
git commit -m "feat(discord): MatchAnnouncer adapter (post embed + start thread)"
```

---

### Task 32: pollPremier job

**Files:**
- Create: `src/jobs/pollPremier.ts`
- Create: `src/jobs/pollPremier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { ok } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  TeamRecord,
  TeamRepository,
} from '../ports/repositories.js'
import { makePollPremierHandler } from './pollPremier.js'

const team: TeamRecord = {
  guildId: 'g1',
  henrikTeamId: 't-1',
  region: 'na',
  captainRoleId: null,
  memberRoleId: null,
  announcementsChannelId: 'ch-1',
  createdAt: 0,
}

describe('pollPremier handler', () => {
  it('enqueues ingestMatch jobs for new match ids only', async () => {
    const teamRepo = {
      findByGuild: vi.fn().mockReturnValue(ok(team)),
    } as unknown as TeamRepository
    const matchRepo = {
      findByMatchId: vi
        .fn()
        .mockImplementation((_g: string, id: string) =>
          ok(id === 'M-old' ? { matchId: 'M-old' } : null),
        ),
    } as unknown as MatchRepository
    const provider = {
      listRecentMatches: vi.fn().mockResolvedValue(
        ok([
          { matchId: 'M-old', playedAt: 1, map: 'Ascent' },
          { matchId: 'M-new', playedAt: 2, map: 'Bind' },
        ]),
      ),
    } as unknown as MatchDataProvider
    const enqueued: Array<{ kind: string; payload: unknown }> = []
    const jobRepo = {
      enqueue: vi.fn().mockImplementation((kind: string, payload: unknown) => {
        enqueued.push({ kind, payload })
        return ok(0)
      }),
    } as unknown as JobRepository

    const handler = makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })
    await handler({ guildId: 'g1' })

    expect(enqueued).toEqual([
      { kind: 'ingestMatch', payload: { guildId: 'g1', matchId: 'M-new' } },
    ])
  })

  it('no-ops when team has no henrik_team_id', async () => {
    const teamRepo = {
      findByGuild: vi.fn().mockReturnValue(ok({ ...team, henrikTeamId: null })),
    } as unknown as TeamRepository
    const provider = { listRecentMatches: vi.fn() } as unknown as MatchDataProvider
    const jobRepo = { enqueue: vi.fn() } as unknown as JobRepository
    const matchRepo = { findByMatchId: vi.fn() } as unknown as MatchRepository
    const handler = makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })
    await handler({ guildId: 'g1' })
    expect(provider.listRecentMatches).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm test src/jobs/pollPremier.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement handler**

```ts
import { isErr } from '../domain/result.js'
import type { MatchDataProvider } from '../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  TeamRepository,
} from '../ports/repositories.js'
import type { JobHandler } from './worker.js'

export type PollPremierDeps = {
  teamRepo: TeamRepository
  matchRepo: MatchRepository
  provider: MatchDataProvider
  jobRepo: JobRepository
}

export type PollPremierPayload = { guildId: string }

export const makePollPremierHandler =
  (deps: PollPremierDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as PollPremierPayload
    const team = deps.teamRepo.findByGuild(payload.guildId)
    if (isErr(team) || !team.value) return
    if (!team.value.henrikTeamId || !team.value.region) return

    const list = await deps.provider.listRecentMatches(team.value.region, team.value.henrikTeamId)
    if (isErr(list)) throw new Error(`provider list failed: ${list.error.tag}`)

    for (const m of list.value) {
      const existing = deps.matchRepo.findByMatchId(payload.guildId, m.matchId)
      if (isErr(existing)) continue
      if (existing.value) continue
      deps.jobRepo.enqueue('ingestMatch', { guildId: payload.guildId, matchId: m.matchId })
    }
  }
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm test src/jobs/pollPremier.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/jobs/pollPremier.ts src/jobs/pollPremier.test.ts
git commit -m "feat(jobs): pollPremier handler enqueues ingestMatch for new matches"
```

---

### Task 33: ingestMatch job handler wrapper

**Files:**
- Create: `src/jobs/ingestMatch.ts`

- [ ] **Step 1: Implement handler**

```ts
import { isErr } from '../domain/result.js'
import { ingestMatch, type IngestMatchDeps } from '../app/ingestMatch.js'
import type { JobHandler } from './worker.js'

export type IngestMatchJobPayload = { guildId: string; matchId: string }

export const makeIngestMatchHandler =
  (deps: IngestMatchDeps): JobHandler =>
  async (raw: unknown) => {
    const payload = raw as IngestMatchJobPayload
    const r = await ingestMatch(deps, payload)
    if (isErr(r)) throw new Error(`ingestMatch failed: ${r.error.tag}`)
  }
```

- [ ] **Step 2: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/jobs/ingestMatch.ts
git commit -m "feat(jobs): ingestMatch handler"
```

---

## Milestone 11 — Match commands

### Task 34: /match latest and /match link

**Files:**
- Create: `src/adapters/discord/commands/match.ts`
- Modify: `src/adapters/discord/commands/index.ts`

- [ ] **Step 1: Implement /match**

```ts
import { SlashCommandBuilder } from 'discord.js'
import { isErr, isOk } from '../../../domain/result.js'
import type { JobRepository, MatchRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

const extractMatchId = (input: string): string | null => {
  const trimmed = input.trim()
  if (/^[A-Za-z0-9-]+$/.test(trimmed)) return trimmed
  const m = trimmed.match(/match\/(?:[a-z]+\/)?([A-Za-z0-9-]+)/i)
  return m?.[1] ?? null
}

export const matchCommand = (
  matchRepo: MatchRepository,
  jobRepo: JobRepository,
): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Match ingestion controls.')
    .addSubcommand((s) =>
      s.setName('latest').setDescription('Re-ingest and re-post the most recent stored match.'),
    )
    .addSubcommand((s) =>
      s
        .setName('link')
        .setDescription('Manually ingest a match by URL or id.')
        .addStringOption((o) =>
          o.setName('id-or-url').setDescription('Henrik match id or tracker URL').setRequired(true),
        ),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'latest') {
      const recent = matchRepo.listRecent(interaction.guildId, 1)
      if (isErr(recent) || recent.value.length === 0) {
        await interaction.reply({
          ephemeral: true,
          content: 'No matches stored yet. Use `/match link` to ingest one manually.',
        })
        return
      }
      const m = recent.value[0]
      if (!m) return
      const e = jobRepo.enqueue('ingestMatch', {
        guildId: interaction.guildId,
        matchId: m.matchId,
      })
      await interaction.reply({
        ephemeral: true,
        content: isOk(e) ? `Re-ingest queued for match \`${m.matchId}\`.` : 'Failed to enqueue.',
      })
      return
    }

    // link
    const raw = interaction.options.getString('id-or-url', true)
    const id = extractMatchId(raw)
    if (!id) {
      await interaction.reply({
        ephemeral: true,
        content: 'Could not extract a match id from that input.',
      })
      return
    }
    const e = jobRepo.enqueue('ingestMatch', { guildId: interaction.guildId, matchId: id })
    await interaction.reply({
      ephemeral: true,
      content: isOk(e) ? `Ingest queued for match \`${id}\`.` : 'Failed to enqueue.',
    })
  },
})
```

- [ ] **Step 2: Wire into index**

Replace `src/adapters/discord/commands/index.ts`:

```ts
import type { MatchDataProvider } from '../../../ports/matchData.js'
import type {
  JobRepository,
  MatchRepository,
  PlayerRepository,
  TeamRepository,
} from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'
import { helpCommand } from './help.js'
import { linkCommand, unlinkCommand } from './link.js'
import { matchCommand } from './match.js'
import { rosterCommand } from './roster.js'
import { teamCommand } from './team.js'

export type CommandDeps = {
  teamRepo: TeamRepository
  playerRepo: PlayerRepository
  matchRepo: MatchRepository
  jobRepo: JobRepository
  provider: MatchDataProvider
}

export const allCommands = (deps: CommandDeps): SlashCommand[] => [
  helpCommand,
  teamCommand(deps.teamRepo),
  linkCommand(deps.provider, deps.playerRepo),
  unlinkCommand(deps.playerRepo),
  rosterCommand(deps.provider, deps.playerRepo),
  matchCommand(deps.matchRepo, deps.jobRepo),
]
```

- [ ] **Step 3: Verify compile**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/discord/commands/match.ts src/adapters/discord/commands/index.ts
git commit -m "feat(discord): /match latest + /match link"
```

---

## Milestone 12 — Composition root + deploy

### Task 35: main.ts composition root

**Files:**
- Create: `src/main.ts`
- Modify: `scripts/register-commands.ts` (refactor to share construction)

- [ ] **Step 1: Implement main**

```ts
import { config as loadDotenv } from 'dotenv'
import cron from 'node-cron'
import { DiscordMatchAnnouncer } from './adapters/discord/announcer.js'
import { createDiscordClient } from './adapters/discord/client.js'
import { allCommands, type CommandDeps } from './adapters/discord/commands/index.js'
import { buildRegistry } from './adapters/discord/registry.js'
import { routeInteraction } from './adapters/discord/router.js'
import { HenrikClient } from './adapters/henrik/client.js'
import { openDb } from './adapters/sqlite/db.js'
import { SqliteJobRepository } from './adapters/sqlite/jobRepo.js'
import { SqliteMatchRepository } from './adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from './adapters/sqlite/playerRepo.js'
import { SqliteTeamRepository } from './adapters/sqlite/teamRepo.js'
import { loadEnv } from './config/env.js'
import { makeIngestMatchHandler } from './jobs/ingestMatch.js'
import { makePollPremierHandler } from './jobs/pollPremier.js'
import { startWorker } from './jobs/worker.js'
import { createLogger } from './lib/logger.js'

loadDotenv()
const env = loadEnv()
const logger = createLogger(env)

const db = openDb(env.DB_PATH)
const teamRepo = new SqliteTeamRepository(db)
const playerRepo = new SqlitePlayerRepository(db)
const matchRepo = new SqliteMatchRepository(db)
const jobRepo = new SqliteJobRepository(db)
const provider = new HenrikClient({ apiKey: env.HENRIK_API_KEY })

const client = createDiscordClient()
const announcer = new DiscordMatchAnnouncer(client)

const cmdDeps: CommandDeps = { teamRepo, playerRepo, matchRepo, jobRepo, provider }
const registry = buildRegistry(allCommands(cmdDeps))

const handlers = new Map([
  ['pollPremier', makePollPremierHandler({ teamRepo, matchRepo, provider, jobRepo })],
  [
    'ingestMatch',
    makeIngestMatchHandler({ teamRepo, matchRepo, playerRepo, provider, announcer }),
  ],
])

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return
  await routeInteraction(i, { registry, teamRepo, ctx: { logger } })
})

client.once('ready', () => {
  logger.info({ user: client.user?.tag }, 'discord client ready')
})

const ac = new AbortController()
const stop = () => {
  logger.info('shutting down')
  ac.abort()
  client.destroy().catch(() => {})
  db.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

await client.login(env.DISCORD_TOKEN)

cron.schedule('*/5 * * * *', () => {
  for (const guildId of client.guilds.cache.keys()) {
    jobRepo.enqueue('pollPremier', { guildId })
  }
})

void startWorker({ repo: jobRepo, handlers, maxJobs: 3, signal: ac.signal })
```

- [ ] **Step 2: Refactor scripts/register-commands.ts to reuse the same dep wiring**

Replace `scripts/register-commands.ts`:

```ts
import { REST, Routes } from 'discord.js'
import { config as loadDotenv } from 'dotenv'
import { allCommands } from '../src/adapters/discord/commands/index.js'
import { HenrikClient } from '../src/adapters/henrik/client.js'
import { openDb } from '../src/adapters/sqlite/db.js'
import { SqliteJobRepository } from '../src/adapters/sqlite/jobRepo.js'
import { SqliteMatchRepository } from '../src/adapters/sqlite/matchRepo.js'
import { SqlitePlayerRepository } from '../src/adapters/sqlite/playerRepo.js'
import { SqliteTeamRepository } from '../src/adapters/sqlite/teamRepo.js'
import { loadEnv } from '../src/config/env.js'

loadDotenv()
const env = loadEnv()
const db = openDb(env.DB_PATH)

const body = allCommands({
  teamRepo: new SqliteTeamRepository(db),
  playerRepo: new SqlitePlayerRepository(db),
  matchRepo: new SqliteMatchRepository(db),
  jobRepo: new SqliteJobRepository(db),
  provider: new HenrikClient({ apiKey: env.HENRIK_API_KEY }),
}).map((c) => c.data.toJSON())

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

const main = async () => {
  await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body })
  console.log(`registered ${body.length} commands globally`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.close())
```

- [ ] **Step 3: Verify compile**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts scripts/register-commands.ts
git commit -m "feat: composition root + cron-driven pollPremier scheduling"
```

---

### Task 36: systemd unit + Dockerfile + README quickstart

**Files:**
- Create: `systemd/premier-bot.service`
- Create: `Dockerfile`
- Create: `README.md`

- [ ] **Step 1: Create systemd unit**

```ini
[Unit]
Description=premier-bot Discord service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=premier
Group=premier
WorkingDirectory=/opt/premier-bot
EnvironmentFile=/etc/premier-bot.env
ExecStart=/usr/bin/node --enable-source-maps dist/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create Dockerfile**

```Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json biome.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV DB_PATH=/app/data/premier.db
CMD ["node", "--enable-source-maps", "dist/main.js"]
```

- [ ] **Step 3: Create README quickstart**

```markdown
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
6. As a server admin run `/team set` for `region`, `henrik-team-id`, `captain-role`, `member-role`, `channel`
7. Captain runs `/roster add @user RiotName#TAG <role>` for each player (or members run `/link`, then captain runs `/roster set-role`)

## Docker

```bash
docker build -t premier-bot .
docker run -d --name premier-bot --env-file .env -v $(pwd)/data:/app/data premier-bot
```
```

- [ ] **Step 4: Commit**

```bash
git add systemd/premier-bot.service Dockerfile README.md
git commit -m "chore: deployment artifacts (systemd + Dockerfile + README)"
```

---

## Self-review

After every milestone, run `pnpm test && pnpm tsc --noEmit && pnpm lint` before moving on. The MVP is shippable when:

- `/help`, `/team set`, `/team show`, `/link`, `/unlink`, `/roster add|remove|set-role`, `/match latest`, `/match link` all work end-to-end
- A new Premier match in the team's history results in a thread being opened in the configured announcements channel within ~5 minutes, containing a stats embed showing the team's scoreboard
- Bot survives restart with no data loss (SQLite WAL + persisted job queue)

## Spec coverage map (MVP scope only)

| Spec section | Tasks |
|---|---|
| §3 Stack | 1, 2, 3 |
| §4 Architecture / project layout | all |
| §4.2 Result-based error handling | 5, 6, every adapter/use-case |
| §5 Data model (teams, players, matches, jobs) | 9 |
| §6.1 HenrikDev port + adapter | 17, 18 |
| §7 Slash commands (MVP subset) | 22, 24, 26, 27, 34 |
| §8 pollPremier + ingestMatch jobs | 28, 32, 33 |
| §9 Permission model | 20, 21 |
| §10 Env config | 4 |
| §11 Deploy (systemd + Dockerfile + README) | 36 |
| §12 Testing (vitest, mock-first, in-memory SQLite) | every test step |

**Deferred to Plan 2/3/4 (intentionally not in this plan):**
- §6.2 Gemini AICoach port + adapter
- §7 `/scrim …`, `/match coach`, `/vod …`, `/stats season`
- §8 `summarizeMatch`, `sendReminder` jobs + §8.1 DM-disabled fallback
- §9 captain-only role assignment AI behavior (the rule is encoded in the spec; AI side ships in Plan 2)
- `ai_summaries`, `scrims`, `rsvps`, `vods`, `vod_notes` tables (introduced via additional migration files in their respective plans)

---

**Plan complete.** Saved to `docs/superpowers/plans/2026-05-03-premier-bot-mvp.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with isolated context per task.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
