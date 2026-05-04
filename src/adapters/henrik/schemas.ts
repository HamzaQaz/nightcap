import { z } from 'zod'

export const HenrikAccount = z.object({
  status: z.number(),
  data: z.object({
    puuid: z.string(),
    name: z.string(),
    tag: z.string(),
    region: z.string(),
  }),
})

export const HenrikPremierTeam = z.object({
  status: z.number(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    tag: z.string(),
    region: z.string(),
    members: z
      .array(z.object({ puuid: z.string(), name: z.string(), tag: z.string() }))
      .optional()
      .default([]),
  }),
})

export const HenrikPremierMatchSummary = z.object({
  id: z.string(),
  started_at: z.string(),
  map: z.object({ name: z.string() }).optional(),
})

export const HenrikPremierHistory = z.object({
  status: z.number(),
  data: z.object({
    matches: z.array(HenrikPremierMatchSummary).default([]),
  }),
})

export const HenrikMatchPlayer = z.object({
  puuid: z.string(),
  name: z.string(),
  tag: z.string(),
  team_id: z.string(),
  agent: z.object({ name: z.string() }),
  stats: z.object({
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    headshots: z.number(),
    bodyshots: z.number(),
    legshots: z.number(),
    damage: z.object({ dealt: z.number() }),
  }),
})

export const HenrikMatchDetail = z.object({
  status: z.number(),
  data: z.object({
    metadata: z.object({
      match_id: z.string(),
      started_at: z.string(),
      map: z.object({ name: z.string() }),
      season: z.object({ id: z.string() }).nullable().optional(),
    }),
    players: z.array(HenrikMatchPlayer),
    teams: z.array(
      z.object({ team_id: z.string(), won: z.boolean(), rounds: z.object({ won: z.number() }) }),
    ),
  }),
})

export type HenrikMatchDetailType = z.infer<typeof HenrikMatchDetail>
