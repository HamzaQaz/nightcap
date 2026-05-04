import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { TeamRecord, TeamRepository } from '../ports/repositories.js'
import { setTeamConfig } from './setTeamConfig.js'

const fakeRepo = (): TeamRepository => ({
  findByGuild: vi.fn().mockReturnValue(ok(null)),
  upsert: vi.fn((p) =>
    ok({
      guildId: p.guildId,
      henrikTeamId: p.henrikTeamId ?? null,
      region: p.region ?? null,
      conference: p.conference ?? null,
      captainRoleId: p.captainRoleId ?? null,
      memberRoleId: p.memberRoleId ?? null,
      announcementsChannelId: p.announcementsChannelId ?? null,
      createdAt: 0,
    } satisfies TeamRecord),
  ),
})

describe('setTeamConfig', () => {
  it('rejects an unknown region', () => {
    const r = setTeamConfig(fakeRepo(), { guildId: 'g1', region: 'mars' })
    if (isErr(r)) {
      expect(r.error.tag).toBe('validation')
      if (r.error.tag === 'validation') expect(r.error.field).toBe('region')
    } else throw new Error('expected err')
  })

  it('upserts a valid region', () => {
    const repo = fakeRepo()
    const r = setTeamConfig(repo, { guildId: 'g1', region: 'NA' })
    if (isOk(r)) expect(r.value.region).toBe('na')
    else throw new Error('expected ok')
  })

  it('rejects malformed conference id', () => {
    const r = setTeamConfig(fakeRepo(), { guildId: 'g1', conference: 'not a conference' })
    if (isErr(r)) {
      expect(r.error.tag).toBe('validation')
      if (r.error.tag === 'validation') expect(r.error.field).toBe('conference')
    } else throw new Error('expected err')
  })

  it('upserts a valid conference (and uppercases it)', () => {
    const repo = fakeRepo()
    const r = setTeamConfig(repo, { guildId: 'g1', conference: 'na_us_west' })
    if (isOk(r)) expect(r.value.conference).toBe('NA_US_WEST')
    else throw new Error('expected ok')
  })

  it('passes through role + channel ids unchanged', () => {
    const repo = fakeRepo()
    const r = setTeamConfig(repo, {
      guildId: 'g1',
      captainRoleId: 'role-1',
      announcementsChannelId: 'ch-1',
    })
    if (isOk(r)) {
      expect(r.value.captainRoleId).toBe('role-1')
      expect(r.value.announcementsChannelId).toBe('ch-1')
    } else throw new Error('expected ok')
  })
})
