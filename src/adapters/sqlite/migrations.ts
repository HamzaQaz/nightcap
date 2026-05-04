import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Migration } from './migrator.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

export const ALL_MIGRATIONS: Migration[] = [
  { id: '0001_init', sql: readFileSync(resolve(root, 'migrations/0001_init.sql'), 'utf8') },
]
