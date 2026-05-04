import pino, { type LoggerOptions } from 'pino'
import type { Env } from '../config/env.js'

export const createLogger = (env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>) => {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { app: 'premier-bot' },
  }
  if (env.NODE_ENV === 'development') {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    }
  }
  return pino(options)
}

export type Logger = ReturnType<typeof createLogger>
