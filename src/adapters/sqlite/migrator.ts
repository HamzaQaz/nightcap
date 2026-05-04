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
