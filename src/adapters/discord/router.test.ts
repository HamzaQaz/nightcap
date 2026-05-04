import { describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../lib/logger.js'
import type { TeamRepository } from '../../ports/repositories.js'
import type { CommandContext, SlashCommand } from './command.js'
import { buildRegistry } from './registry.js'
import { routeInteraction } from './router.js'

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Logger

const okTeamRepo = {
  findByGuild: () => ({ _tag: 'ok' as const, value: null }),
} as unknown as TeamRepository

const fakeInteraction = (overrides: Record<string, unknown> = {}) => {
  const reply = vi.fn().mockResolvedValue(undefined)
  return {
    isChatInputCommand: () => true,
    commandName: 'help',
    guildId: 'g1',
    member: { permissions: { has: () => true }, roles: { cache: new Map() } },
    reply,
    deferReply: vi.fn(),
    editReply: vi.fn(),
    ...overrides,
  } as never
}

describe('routeInteraction', () => {
  it('runs the matching command', async () => {
    const exec = vi.fn().mockResolvedValue(undefined)
    const cmd: SlashCommand = {
      data: { name: 'help', toJSON: () => ({}) } as unknown as SlashCommand['data'],
      permission: 'anyone',
      execute: exec,
    }
    const registry = buildRegistry([cmd])
    await routeInteraction(fakeInteraction(), {
      registry,
      teamRepo: okTeamRepo,
      ctx: { logger: noopLogger } satisfies CommandContext,
    })
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('replies with permission-denied for unauthorized user', async () => {
    const exec = vi.fn()
    const cmd: SlashCommand = {
      data: { name: 'team', toJSON: () => ({}) } as unknown as SlashCommand['data'],
      permission: 'captain',
      execute: exec,
    }
    const registry = buildRegistry([cmd])
    const i = fakeInteraction({
      commandName: 'team',
      member: { permissions: { has: () => false }, roles: { cache: new Map() } },
    })
    await routeInteraction(i, {
      registry,
      teamRepo: okTeamRepo,
      ctx: { logger: noopLogger } satisfies CommandContext,
    })
    expect(exec).not.toHaveBeenCalled()
    expect((i as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    )
  })
})
