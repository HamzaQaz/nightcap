import { describe, expect, it, vi } from 'vitest'
import { ok } from '../domain/result.js'
import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { makeSendReminderHandler } from './sendReminder.js'

describe('sendReminder', () => {
  it('posts T-60 reminder mentioning member role + map', async () => {
    const announcer = {
      postPlainAnnouncement: vi.fn().mockResolvedValue(ok(undefined)),
      postMatchNightPoll: vi.fn(),
      postSkipWeek: vi.fn(),
      updatePollMessage: vi.fn(),
    } as unknown as ScheduleAnnouncer
    const handler = makeSendReminderHandler({ announcer })
    await handler({
      guildId: 'g1',
      channelId: 'ch1',
      memberRoleId: 'mr',
      matchStartAt: Date.parse('2026-05-09T22:00:00.000Z'),
      mapName: 'Ascent',
      minutesAhead: 60,
    })
    const calls = (announcer.postPlainAnnouncement as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0]).toBe('ch1')
    expect(calls[0]?.[1]).toContain('<@&mr>')
    expect(calls[0]?.[1]).toContain('Ascent')
    expect(calls[0]?.[1]).toContain('1 hour')
  })

  it('posts T-10 reminder', async () => {
    const announcer = {
      postPlainAnnouncement: vi.fn().mockResolvedValue(ok(undefined)),
      postMatchNightPoll: vi.fn(),
      postSkipWeek: vi.fn(),
      updatePollMessage: vi.fn(),
    } as unknown as ScheduleAnnouncer
    const handler = makeSendReminderHandler({ announcer })
    await handler({
      guildId: 'g1',
      channelId: 'ch1',
      memberRoleId: null,
      matchStartAt: Date.parse('2026-05-09T22:00:00.000Z'),
      mapName: null,
      minutesAhead: 10,
    })
    const calls = (announcer.postPlainAnnouncement as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[1]).toContain('10 min')
    expect(calls[0]?.[1]).not.toContain('<@&')
  })
})
