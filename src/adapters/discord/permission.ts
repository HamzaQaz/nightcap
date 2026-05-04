import type { TeamRecord } from '../../ports/repositories.js'
import type { CommandPermission } from './command.js'

export type PermissionContext = {
  team: TeamRecord | null
  userRoleIds: string[]
  isAdmin: boolean
}

export const canRunCommand = (
  required: CommandPermission,
  ctx: PermissionContext,
): boolean => {
  if (required === 'anyone') return true
  if (ctx.isAdmin) return true
  if (!ctx.team) return false
  if (required === 'captain') {
    return ctx.team.captainRoleId !== null && ctx.userRoleIds.includes(ctx.team.captainRoleId)
  }
  // member: captain-role users implicitly count as members
  if (
    ctx.team.captainRoleId !== null &&
    ctx.userRoleIds.includes(ctx.team.captainRoleId)
  )
    return true
  return ctx.team.memberRoleId !== null && ctx.userRoleIds.includes(ctx.team.memberRoleId)
}
