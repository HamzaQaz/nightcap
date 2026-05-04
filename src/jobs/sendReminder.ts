import type { ScheduleAnnouncer } from '../ports/scheduleAnnouncer.js'
import { isErr } from '../domain/result.js'
import type { JobHandler } from './worker.js'

export type SendReminderPayload = {
  guildId: string
  channelId: string
  memberRoleId: string | null
  matchStartAt: number
  mapName: string | null
  minutesAhead: number
}

export type SendReminderDeps = {
  announcer: ScheduleAnnouncer
}

export const makeSendReminderHandler =
  (deps: SendReminderDeps): JobHandler =>
  async (raw: unknown) => {
    const p = raw as SendReminderPayload
    const ping = p.memberRoleId ? `<@&${p.memberRoleId}>` : ''
    const minLabel = p.minutesAhead >= 60 ? '1 hour' : `${p.minutesAhead} min`
    const map = p.mapName ? ` on **${p.mapName}**` : ''
    const content = `${ping}\nMatch starts in ${minLabel} (<t:${Math.floor(p.matchStartAt / 1000)}:t>)${map}.`
    const r = await deps.announcer.postPlainAnnouncement(p.channelId, content)
    if (isErr(r)) throw new Error(`sendReminder failed: ${r.error.tag}`)
  }
