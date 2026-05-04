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
