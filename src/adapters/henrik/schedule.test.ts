import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HenrikSeasonsResponse } from './schemas.js'
import { resolveSchedule } from './schedule.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const fixture = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/henrik/seasons.json'), 'utf8'),
)

describe('resolveSchedule', () => {
  const parsed = HenrikSeasonsResponse.parse(fixture)
  const now = Date.parse('2026-05-01T00:00:00.000Z')

  it('picks active season, filters by conference, joins map name', () => {
    const out = resolveSchedule(parsed, 'NA_US_WEST', 10, now)
    const maps = out.map((m) => m.mapName)
    expect(maps).toContain('Ascent')
    expect(maps).toContain('Haven')
    expect(out.every((m) => m.conference === 'NA_US_WEST')).toBe(true)
    expect(out.every((m) => m.seasonId === 'season-active')).toBe(true)
  })

  it('dedupes same (event_id, starts_at, conference)', () => {
    const out = resolveSchedule(parsed, 'NA_US_WEST', 10, now)
    const ascentRows = out.filter((m) => m.mapName === 'Ascent')
    expect(ascentRows).toHaveLength(1)
  })

  it('formats TOURNAMENT pickban as a pool', () => {
    const out = resolveSchedule(parsed, 'NA_US_WEST', 10, now)
    const tournament = out.find((m) => m.eventType === 'TOURNAMENT')
    expect(tournament?.mapName).toContain('pool:')
    expect(tournament?.mapName).toContain('Lotus')
  })

  it('sorts by start time and respects limit', () => {
    const out = resolveSchedule(parsed, 'NA_US_WEST', 2, now)
    expect(out).toHaveLength(2)
    expect(out[0]?.mapName).toBe('Ascent')
    expect(out[1]?.mapName).toBe('Haven')
  })

  it('returns next season when none active', () => {
    const futureNow = Date.parse('2026-12-01T00:00:00.000Z')
    const out = resolveSchedule(parsed, 'NA_US_WEST', 10, futureNow)
    expect(out).toEqual([])
  })

  it('returns empty when conference has no scheduled events', () => {
    const out = resolveSchedule(parsed, 'EU_DOES_NOT_EXIST', 10, now)
    expect(out).toEqual([])
  })
})
