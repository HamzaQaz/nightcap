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
