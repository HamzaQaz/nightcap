import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Migration } from './migrator.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

export const ALL_MIGRATIONS: Migration[] = [
  { id: '0001_init', sql: readFileSync(resolve(root, 'migrations/0001_init.sql'), 'utf8') },
  {
    id: '0002_ai_summaries',
    sql: readFileSync(resolve(root, 'migrations/0002_ai_summaries.sql'), 'utf8'),
  },
  {
    id: '0003_scheduling',
    sql: readFileSync(resolve(root, 'migrations/0003_scheduling.sql'), 'utf8'),
  },
  {
    id: '0004_vods',
    sql: readFileSync(resolve(root, 'migrations/0004_vods.sql'), 'utf8'),
  },
]
