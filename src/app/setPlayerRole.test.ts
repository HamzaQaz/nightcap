import { describe, expect, it, vi } from 'vitest'
import { isErr, isOk, ok } from '../domain/result.js'
import type { PlayerRepository } from '../ports/repositories.js'
import { ROLES, setPlayerRole } from './setPlayerRole.js'

describe('setPlayerRole', () => {
  it('rejects unknown roles', () => {
    const repo = { setRole: vi.fn() } as unknown as PlayerRepository
    const r = setPlayerRole(repo, 'g1', 'u1', 'sniper')
    if (isErr(r)) {
      expect(r.error.tag).toBe('validation')
      if (r.error.tag === 'validation') expect(r.error.field).toBe('role')
    } else throw new Error('expected err')
  })

  it('accepts a valid role and forwards to repo', () => {
    const repo = { setRole: vi.fn().mockReturnValue(ok(undefined)) } as unknown as PlayerRepository
    const r = setPlayerRole(repo, 'g1', 'u1', 'duelist')
    expect(isOk(r)).toBe(true)
    expect(repo.setRole).toHaveBeenCalledWith('g1', 'u1', 'duelist')
  })

  it('exports the canonical role list', () => {
    expect(ROLES).toEqual(['duelist', 'initiator', 'controller', 'sentinel', 'flex'])
  })
})
