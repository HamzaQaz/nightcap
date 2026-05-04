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
