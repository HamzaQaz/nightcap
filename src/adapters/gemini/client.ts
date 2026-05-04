import { GoogleGenAI } from '@google/genai'
import type { DomainError } from '../../domain/errors.js'
import { providerError } from '../../domain/errors.js'
import { err, ok, type Result } from '../../domain/result.js'
import {
  type AICoach,
  type AIResult,
  type CoachPlayerInput,
  type CoachTeamInput,
  type PlayerCoaching,
  playerCoachingSchema,
  type TeamCoaching,
  teamCoachingSchema,
} from '../../ports/aiCoach.js'
import { buildPlayerPrompt, buildTeamPrompt, hashPrompt, PROMPT_VERSION } from './prompts.js'
import { PLAYER_RESPONSE_SCHEMA, TEAM_RESPONSE_SCHEMA } from './schemas.js'

export type GenerateFn = (req: {
  prompt: string
  responseSchema: unknown
}) => Promise<{ text: string }>

export type GeminiOpts = {
  apiKey: string
  model?: string
  generate?: GenerateFn
}

const DEFAULT_MODEL = 'gemini-2.5-flash'

export class GeminiCoach implements AICoach {
  private readonly model: string
  private readonly generate: GenerateFn

  constructor(opts: GeminiOpts) {
    this.model = opts.model ?? DEFAULT_MODEL
    this.generate = opts.generate ?? defaultGenerate(opts.apiKey, this.model)
  }

  async summarizeMatchForPlayer(
    input: CoachPlayerInput,
  ): Promise<Result<AIResult<PlayerCoaching>, DomainError>> {
    const prompt = buildPlayerPrompt(input)
    const promptHash = `${PROMPT_VERSION}:${hashPrompt(prompt)}`
    let raw: string
    try {
      const r = await this.generate({ prompt, responseSchema: PLAYER_RESPONSE_SCHEMA })
      raw = r.text
    } catch (e) {
      return err(providerError('gemini', 'unavailable', (e as Error).message))
    }
    const json = safeParseJson(raw)
    if (!json) return err(providerError('gemini', 'bad_response', 'invalid JSON in response'))
    const parsed = playerCoachingSchema.safeParse(json)
    if (!parsed.success) return err(providerError('gemini', 'bad_response', parsed.error.message))
    return ok({ output: parsed.data, model: this.model, promptHash })
  }

  async summarizeMatchForTeam(
    input: CoachTeamInput,
  ): Promise<Result<AIResult<TeamCoaching>, DomainError>> {
    const prompt = buildTeamPrompt(input)
    const promptHash = `${PROMPT_VERSION}:${hashPrompt(prompt)}`
    let raw: string
    try {
      const r = await this.generate({ prompt, responseSchema: TEAM_RESPONSE_SCHEMA })
      raw = r.text
    } catch (e) {
      return err(providerError('gemini', 'unavailable', (e as Error).message))
    }
    const json = safeParseJson(raw)
    if (!json) return err(providerError('gemini', 'bad_response', 'invalid JSON in response'))
    const parsed = teamCoachingSchema.safeParse(json)
    if (!parsed.success) return err(providerError('gemini', 'bad_response', parsed.error.message))
    return ok({ output: parsed.data, model: this.model, promptHash })
  }
}

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const defaultGenerate = (apiKey: string, model: string): GenerateFn => {
  const ai = new GoogleGenAI({ apiKey })
  return async ({ prompt, responseSchema }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema as Record<string, unknown>,
      },
    })
    const text = res.text ?? ''
    if (!text) throw new Error('empty response from Gemini')
    return { text }
  }
}
