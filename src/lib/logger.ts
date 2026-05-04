import pino from 'pino'
import type { Env } from '../config/env.js'

export const createLogger = (env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>) =>
  pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    base: { app: 'premier-bot' },
  })

export type Logger = ReturnType<typeof createLogger>
