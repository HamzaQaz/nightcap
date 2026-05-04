import { describe, expect, it } from 'vitest'
import { isOk } from '../../domain/result.js'
import { openDb } from './db.js'
import { SqliteVodNotesRepository, SqliteVodsRepository } from './vodRepos.js'

describe('SqliteVodsRepository', () => {
  it('inserts, finds by id, lists by guild, finds by matchId', () => {
    const db = openDb(':memory:')
    const repo = new SqliteVodsRepository(db)
    const id = repo.insert({
      guildId: 'g1',
      matchId: 'M-1',
      url: 'https://twitch.tv/x',
      threadId: null,
      addedBy: 'u1',
      createdAt: 100,
    })
    if (!isOk(id)) return
    repo.setThreadId(id.value, 'thread-vod')

    const found = repo.findById(id.value)
    if (isOk(found) && found.value) {
      expect(found.value.threadId).toBe('thread-vod')
      expect(found.value.matchId).toBe('M-1')
    }
    const list = repo.listByGuild('g1', 5)
    if (isOk(list)) expect(list.value).toHaveLength(1)
    const byMatch = repo.findByMatchId('g1', 'M-1')
    if (isOk(byMatch)) expect(byMatch.value?.id).toBe(id.value)
  })
})

describe('SqliteVodNotesRepository', () => {
  it('inserts notes ordered by timestamp', () => {
    const db = openDb(':memory:')
    const vods = new SqliteVodsRepository(db)
    const notes = new SqliteVodNotesRepository(db)
    const vod = vods.insert({
      guildId: 'g1',
      matchId: null,
      url: 'https://twitch.tv/x',
      threadId: null,
      addedBy: 'u1',
      createdAt: 100,
    })
    if (!isOk(vod)) return
    notes.insert({
      vodId: vod.value,
      timestampSeconds: 120,
      targetDiscordId: 'u2',
      authorDiscordId: 'u1',
      text: 'first',
      createdAt: 1,
    })
    notes.insert({
      vodId: vod.value,
      timestampSeconds: 30,
      targetDiscordId: null,
      authorDiscordId: 'u1',
      text: 'second',
      createdAt: 2,
    })
    const list = notes.listByVod(vod.value)
    if (isOk(list)) {
      expect(list.value[0]?.timestampSeconds).toBe(30)
      expect(list.value[1]?.timestampSeconds).toBe(120)
    }
  })
})
