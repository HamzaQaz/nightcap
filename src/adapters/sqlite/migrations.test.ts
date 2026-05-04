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
