import { z } from 'zod'

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  HENRIK_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  DB_PATH: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
})

export type Env = z.infer<typeof EnvSchema>

export const loadEnv = (raw: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`invalid environment: ${issues}`)
  }
  return parsed.data
}
