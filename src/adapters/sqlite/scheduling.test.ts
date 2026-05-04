import { describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { openDb } from './db.js'
import { SqliteMatchNightsRepository } from './matchNightsRepo.js'
import {
  SqliteMatchNightPollsRepository,
  SqlitePollRsvpsRepository,
} from './matchNightPollsRepo.js'
import { SqliteRsvpsRepository } from './rsvpsRepo.js'
import { SqliteScrimsRepository } from './scrimsRepo.js'

describe('SqliteMatchNightsRepository', () => {
  it('upserts, lists in preference order, removes', () => {
    const repo = new SqliteMatchNightsRepository(openDb(':memory:'))
    repo.upsert({ guildId: 'g1', weekday: 6, preferenceOrder: 1 })
    repo.upsert({ guildId: 'g1', weekday: 0, preferenceOrder: 2 })
    repo.upsert({ guildId: 'g1', weekday: 6, preferenceOrder: 1 }) // idempotent
    const list = repo.listByGuild('g1')
    if (isOk(list)) {
      expect(list.value).toHaveLength(2)
      expect(list.value[0]?.preferenceOrder).toBe(1)
      expect(list.value[1]?.preferenceOrder).toBe(2)
    }
    repo.remove('g1', 6)
    const after = repo.listByGuild('g1')
    if (isOk(after)) expect(after.value).toHaveLength(1)
  })
})

describe('SqliteScrimsRepository + SqliteRsvpsRepository', () => {
  it('inserts scrim, sets status, persists rsvps, counts yes', () => {
    const db = openDb(':memory:')
    const scrims = new SqliteScrimsRepository(db)
    const rsvps = new SqliteRsvpsRepository(db)
    const id = scrims.insert({
      guildId: 'g1',
      proposedBy: 'u1',
      startAt: 1000,
      status: 'proposed',
      messageId: null,
      note: 'fri night',
      createdAt: 999,
    })
    expect(isOk(id)).toBe(true)
    if (!isOk(id)) return
    rsvps.upsert({ scrimId: id.value, discordId: 'u1', status: 'yes', updatedAt: 1 })
    rsvps.upsert({ scrimId: id.value, discordId: 'u2', status: 'yes', updatedAt: 2 })
    rsvps.upsert({ scrimId: id.value, discordId: 'u3', status: 'no', updatedAt: 3 })
    rsvps.upsert({ scrimId: id.value, discordId: 'u2', status: 'yes', updatedAt: 4 }) // dedupe
    const cnt = rsvps.countYes(id.value)
    if (isOk(cnt)) expect(cnt.value).toBe(2)

    scrims.setStatus(id.value, 'cancelled')
    const open = scrims.listOpenByGuild('g1')
    if (isOk(open)) expect(open.value).toHaveLength(0)
  })
})

describe('SqliteMatchNightPollsRepository + SqlitePollRsvpsRepository', () => {
  it('full poll lifecycle', () => {
    const db = openDb(':memory:')
    const polls = new SqliteMatchNightPollsRepository(db)
    const rsvps = new SqlitePollRsvpsRepository(db)
    const id = polls.insert({
      guildId: 'g1',
      weekday: 6,
      preferenceOrder: 1,
      matchStartAt: 5000,
      matchEndAt: 7000,
      mapName: 'Ascent',
      messageId: null,
      status: 'open',
      closesAt: 4000,
      yesCount: 0,
      ladderDone: false,
      createdAt: 1,
    })
    if (!isOk(id)) return

    rsvps.upsert({ pollId: id.value, discordId: 'u1', status: 'yes', updatedAt: 10 })
    rsvps.upsert({ pollId: id.value, discordId: 'u2', status: 'yes', updatedAt: 11 })
    rsvps.upsert({ pollId: id.value, discordId: 'u3', status: 'no', updatedAt: 12 })
    const cnt = rsvps.countYes(id.value)
    if (isOk(cnt)) expect(cnt.value).toBe(2)

    polls.setMessageId(id.value, 'msg-1')
    polls.setYesCount(id.value, 2)
    polls.setLadderDone(id.value, true)
    const open = polls.findOpenForGuild('g1')
    if (isOk(open) && open.value) {
      expect(open.value.messageId).toBe('msg-1')
      expect(open.value.yesCount).toBe(2)
      expect(open.value.ladderDone).toBe(true)
    }

    polls.setStatus(id.value, 'closed_quorum')
    const noOpen = polls.findOpenForGuild('g1')
    if (isOk(noOpen)) expect(noOpen.value).toBeNull()
  })

  it('listClosingBefore returns only open polls past their close time', () => {
    const db = openDb(':memory:')
    const polls = new SqliteMatchNightPollsRepository(db)
    polls.insert({
      guildId: 'g1',
      weekday: 6,
      preferenceOrder: 1,
      matchStartAt: 5000,
      matchEndAt: 7000,
      mapName: null,
      messageId: null,
      status: 'open',
      closesAt: 100,
      yesCount: 0,
      ladderDone: false,
      createdAt: 1,
    })
    polls.insert({
      guildId: 'g2',
      weekday: 0,
      preferenceOrder: 2,
      matchStartAt: 9000,
      matchEndAt: 11000,
      mapName: null,
      messageId: null,
      status: 'open',
      closesAt: 8000,
      yesCount: 0,
      ladderDone: false,
      createdAt: 2,
    })
    const due = polls.listClosingBefore(500)
    if (isOk(due)) expect(due.value).toHaveLength(1)
  })
})
