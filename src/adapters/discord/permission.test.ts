import { describe, expect, it } from 'vitest'
import type { TeamRecord } from '../../ports/repositories.js'
import { canRunCommand } from './permission.js'

const team: TeamRecord = {
  guildId: 'g1',
  henrikTeamId: null,
  region: null,
  conference: null,
  captainRoleId: 'r-cap',
  memberRoleId: 'r-mem',
  announcementsChannelId: null,
  createdAt: 0,
}

describe('canRunCommand', () => {
  it('always allows anyone-perm commands', () => {
    expect(canRunCommand('anyone', { team, userRoleIds: [], isAdmin: false })).toBe(true)
  })

  it('allows admins to run anything', () => {
    expect(canRunCommand('captain', { team, userRoleIds: [], isAdmin: true })).toBe(true)
  })

  it('allows captain-role users to run captain commands', () => {
    expect(canRunCommand('captain', { team, userRoleIds: ['r-cap'], isAdmin: false })).toBe(true)
  })

  it('rejects non-captain users from captain commands', () => {
    expect(canRunCommand('captain', { team, userRoleIds: ['r-mem'], isAdmin: false })).toBe(false)
  })

  it('allows member-role users to run member commands', () => {
    expect(canRunCommand('member', { team, userRoleIds: ['r-mem'], isAdmin: false })).toBe(true)
  })

  it('captain-role users can also run member commands', () => {
    expect(canRunCommand('member', { team, userRoleIds: ['r-cap'], isAdmin: false })).toBe(true)
  })

  it('rejects when team has no role configured and user is not admin', () => {
    const t = { ...team, captainRoleId: null, memberRoleId: null }
    expect(canRunCommand('member', { team: t, userRoleIds: [], isAdmin: false })).toBe(false)
  })
})
