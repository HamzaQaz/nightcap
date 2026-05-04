import { z } from 'zod'
import type { DomainError } from '../domain/errors.js'
import type { Result } from '../domain/result.js'

export const playerCoachingSchema = z.object({
  public: z.object({
    tldr: z.string().max(160),
    highlight: z.string(),
    focus_area: z.string(),
    role_involvement_pct: z.number().min(0).max(100),
    role_involvement_one_liner: z.string().max(100),
  }),
  private: z.object({
    tldr: z.string().max(200),
    did_well: z.array(z.string()).min(1).max(3),
    improve: z.array(z.string()).min(1).max(3),
    coaching_tip: z.string(),
    role_involvement: z.object({
      pct: z.number().min(0).max(100),
      criteria: z.array(
        z.object({
          name: z.string(),
          score_pct: z.number().min(0).max(100),
          evidence: z.string().max(140),
        }),
      ),
    }),
  }),
})

export type PlayerCoaching = z.infer<typeof playerCoachingSchema>

export const teamCoachingSchema = z.object({
  tldr: z.string(),
  what_worked: z.array(z.string()),
  what_to_fix: z.array(z.string()),
  next_match_focus: z.string(),
})

export type TeamCoaching = z.infer<typeof teamCoachingSchema>

export type PlayerRole = 'duelist' | 'initiator' | 'controller' | 'sentinel' | 'flex'

export type CoachPlayerInput = {
  matchId: string
  matchRawJson: string
  puuid: string
  riotName: string
  role: PlayerRole
  preRoleAssignment: boolean
}

export type CoachTeamInput = {
  matchId: string
  matchRawJson: string
}

export type AIResult<T> = {
  output: T
  model: string
  promptHash: string
}

export interface AICoach {
  summarizeMatchForPlayer(
    input: CoachPlayerInput,
  ): Promise<Result<AIResult<PlayerCoaching>, DomainError>>
  summarizeMatchForTeam(input: CoachTeamInput): Promise<Result<AIResult<TeamCoaching>, DomainError>>
}
