import type { MatchNight } from '../ports/repositories.js'

export const DEFAULT_MATCH_NIGHTS: MatchNight[] = [
  { guildId: '', weekday: 6, preferenceOrder: 1 },
  { guildId: '', weekday: 0, preferenceOrder: 2 },
]

export const resolveMatchNights = (
  guildId: string,
  configured: MatchNight[],
): MatchNight[] => {
  if (configured.length > 0) return [...configured].sort((a, b) => a.preferenceOrder - b.preferenceOrder)
  return DEFAULT_MATCH_NIGHTS.map((n) => ({ ...n, guildId }))
}

export const findNightByOrder = (
  nights: MatchNight[],
  order: number,
): MatchNight | null => nights.find((n) => n.preferenceOrder === order) ?? null

export const nextOrder = (nights: MatchNight[], currentOrder: number): number | null => {
  const sorted = [...nights].sort((a, b) => a.preferenceOrder - b.preferenceOrder)
  for (const n of sorted) if (n.preferenceOrder > currentOrder) return n.preferenceOrder
  return null
}

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
