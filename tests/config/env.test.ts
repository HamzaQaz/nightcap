import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env.js'

describe('loadEnv', () => {
  it('parses a valid env object', () => {
    const env = loadEnv({
      DISCORD_TOKEN: 't',
      DISCORD_APP_ID: 'a',
      GEMINI_API_KEY: 'g',
      DB_PATH: './data/premier.db',
      LOG_LEVEL: 'info',
      NODE_ENV: 'production',
    })
    expect(env.DISCORD_TOKEN).toBe('t')
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.HENRIK_API_KEY).toBeUndefined()
  })

  it('throws on missing required vars', () => {
    expect(() => loadEnv({ DB_PATH: './x' })).toThrow(/DISCORD_TOKEN/)
  })

  it('rejects invalid LOG_LEVEL', () => {
    expect(() =>
      loadEnv({
        DISCORD_TOKEN: 't',
        DISCORD_APP_ID: 'a',
        GEMINI_API_KEY: 'g',
        DB_PATH: './x',
        LOG_LEVEL: 'shouty',
        NODE_ENV: 'production',
      }),
    ).toThrow(/LOG_LEVEL/)
  })
})
