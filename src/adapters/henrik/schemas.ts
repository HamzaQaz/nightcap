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

const HenrikEventTemplate = z.object({
  id: z.string(),
  type: z.enum(['LEAGUE', 'SCRIM', 'TOURNAMENT']),
  map_selection: z.object({
    type: z.enum(['RANDOM', 'PICKBAN']),
    maps: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  }),
  points_required_to_participate: z.number().optional(),
})

const HenrikScheduledEvent = z.object({
  event_id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  conference: z.string(),
})

export const HenrikSeason = z.object({
  id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  events: z.array(HenrikEventTemplate).default([]),
  scheduled_events: z.array(HenrikScheduledEvent).default([]),
})

export const HenrikSeasonsResponse = z.object({
  status: z.number(),
  data: z.array(HenrikSeason),
})

export type HenrikSeasonsType = z.infer<typeof HenrikSeasonsResponse>
