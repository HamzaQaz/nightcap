import { describe, expect, it } from 'vitest'
import { playerCoachingSchema, teamCoachingSchema } from './aiCoach.js'

describe('playerCoachingSchema', () => {
  const valid = {
    public: {
      tldr: 'Solid round, kept site under control',
      highlight: 'Clutch 1v2 on B',
      focus_area: 'Earlier util on retake',
      role_involvement_pct: 78,
      role_involvement_one_liner: 'Held angles + retake util',
    },
    private: {
      tldr: 'Anchored well; util timing slipped twice',
      did_well: ['Site holds', 'Trade timing'],
      improve: ['Smoke timing on retake'],
      coaching_tip: 'Pre-fire common angles after smoke pop',
      role_involvement: {
        pct: 78,
        criteria: [
          { name: 'Site anchor presence', score_pct: 85, evidence: 'Held A all 6 def rounds' },
          { name: 'Util on retake', score_pct: 60, evidence: 'Late molly twice' },
        ],
      },
    },
  }

  it('parses a complete coaching object', () => {
    expect(playerCoachingSchema.parse(valid)).toBeDefined()
  })

  it('rejects pct out of range', () => {
    expect(() =>
      playerCoachingSchema.parse({
        ...valid,
        public: { ...valid.public, role_involvement_pct: 120 },
      }),
    ).toThrow()
  })

  it('rejects empty did_well', () => {
    expect(() =>
      playerCoachingSchema.parse({ ...valid, private: { ...valid.private, did_well: [] } }),
    ).toThrow()
  })

  it('caps tldr length', () => {
    expect(() =>
      playerCoachingSchema.parse({ ...valid, public: { ...valid.public, tldr: 'x'.repeat(200) } }),
    ).toThrow()
  })
})

describe('teamCoachingSchema', () => {
  it('parses', () => {
    const team = {
      tldr: 'Strong A side, B exec timings off',
      what_worked: ['A defaults', 'Mid contact'],
      what_to_fix: ['B exec util order'],
      next_match_focus: 'Drill B retake util order',
    }
    expect(teamCoachingSchema.parse(team)).toBeDefined()
  })
})
