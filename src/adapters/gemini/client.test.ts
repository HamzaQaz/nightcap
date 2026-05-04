import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk } from '../../domain/result.js'
import { GeminiCoach } from './client.js'

const playerJson = JSON.stringify({
  public: {
    tldr: 'Solid anchor on B, util timing slipped twice',
    highlight: 'Clutched 1v2 retake on B round 14',
    focus_area: 'Pre-place molly earlier on retakes',
    role_involvement_pct: 78,
    role_involvement_one_liner: 'Held angles, late retake util on two pushes',
  },
  private: {
    tldr: 'Strong site anchor; refine util timing on retakes',
    did_well: ['Site holds', 'Trade timing'],
    improve: ['Earlier molly on retake', 'Smoke before exec, not during'],
    coaching_tip: 'On retake, throw molly before peeking, not after',
    role_involvement: {
      pct: 78,
      criteria: [
        { name: 'Site anchor presence', score_pct: 85, evidence: 'Held B all defense rounds' },
        { name: 'Util on retake', score_pct: 60, evidence: 'Late molly twice on rounds 9, 14' },
      ],
    },
  },
})

const teamJson = JSON.stringify({
  tldr: 'Strong A-side defense, B exec timings off',
  what_worked: ['A defaults', 'Mid contact'],
  what_to_fix: ['B exec util order', 'Post-plant positioning'],
  next_match_focus: 'Drill B retake util order before next match',
})

describe('GeminiCoach.summarizeMatchForPlayer', () => {
  it('parses + validates the response', async () => {
    const coach = new GeminiCoach({
      apiKey: 'k',
      generate: vi.fn().mockResolvedValue({ text: playerJson }),
    })
    const r = await coach.summarizeMatchForPlayer({
      matchId: 'M-123',
      matchRawJson: '{"data":{"metadata":{"map":{"name":"Ascent"}}}}',
      puuid: 'p1',
      riotName: 'Captain',
      role: 'controller',
      preRoleAssignment: false,
    })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) {
      expect(r.value.output.public.role_involvement_pct).toBe(78)
      expect(r.value.model).toBe('gemini-2.5-flash')
      expect(r.value.promptHash).toMatch(/^v1\.0:/)
    }
  })

  it('returns provider error on invalid JSON', async () => {
    const coach = new GeminiCoach({
      apiKey: 'k',
      generate: vi.fn().mockResolvedValue({ text: 'not json' }),
    })
    const r = await coach.summarizeMatchForPlayer({
      matchId: 'M-123',
      matchRawJson: '{}',
      puuid: 'p1',
      riotName: 'Captain',
      role: 'controller',
      preRoleAssignment: false,
    })
    expect(isErr(r)).toBe(true)
  })

  it('returns provider error on schema mismatch', async () => {
    const coach = new GeminiCoach({
      apiKey: 'k',
      generate: vi.fn().mockResolvedValue({ text: '{"public":{}}' }),
    })
    const r = await coach.summarizeMatchForPlayer({
      matchId: 'M-123',
      matchRawJson: '{}',
      puuid: 'p1',
      riotName: 'Captain',
      role: 'controller',
      preRoleAssignment: false,
    })
    expect(isErr(r)).toBe(true)
  })

  it('flags pre-role assignment in prompt', async () => {
    const generate = vi.fn().mockResolvedValue({ text: playerJson })
    const coach = new GeminiCoach({ apiKey: 'k', generate })
    await coach.summarizeMatchForPlayer({
      matchId: 'M-123',
      matchRawJson: '{}',
      puuid: 'p1',
      riotName: 'Captain',
      role: 'flex',
      preRoleAssignment: true,
    })
    const call = generate.mock.calls[0]?.[0] as { prompt: string }
    expect(call.prompt).toContain('no assigned role yet')
  })

  it('wraps thrown errors as provider_error', async () => {
    const coach = new GeminiCoach({
      apiKey: 'k',
      generate: vi.fn().mockRejectedValue(new Error('429 rate limit')),
    })
    const r = await coach.summarizeMatchForPlayer({
      matchId: 'M-123',
      matchRawJson: '{}',
      puuid: 'p1',
      riotName: 'Captain',
      role: 'duelist',
      preRoleAssignment: false,
    })
    expect(isErr(r)).toBe(true)
    if (isErr(r) && r.error.tag === 'provider_error') {
      expect(r.error.provider).toBe('gemini')
      expect(r.error.kind).toBe('unavailable')
    }
  })
})

describe('GeminiCoach.summarizeMatchForTeam', () => {
  it('parses team output', async () => {
    const coach = new GeminiCoach({
      apiKey: 'k',
      generate: vi.fn().mockResolvedValue({ text: teamJson }),
    })
    const r = await coach.summarizeMatchForTeam({
      matchId: 'M-123',
      matchRawJson: '{}',
    })
    expect(isOk(r)).toBe(true)
    if (isOk(r)) {
      expect(r.value.output.next_match_focus).toContain('B retake')
    }
  })
})
