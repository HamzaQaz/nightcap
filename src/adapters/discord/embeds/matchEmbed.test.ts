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
