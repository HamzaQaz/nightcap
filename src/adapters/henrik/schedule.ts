import type { UpcomingMatch } from '../../ports/matchData.js'
import type { HenrikSeasonsType } from './schemas.js'

export const resolveSchedule = (
  resp: HenrikSeasonsType,
  conference: string,
  limit: number,
  now: number,
): UpcomingMatch[] => {
  if (resp.data.length === 0) return []

  const active = resp.data.find(
    (s) => Date.parse(s.starts_at) <= now && now < Date.parse(s.ends_at),
  )
  const season = active ?? [...resp.data].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  if (!season) return []

  const eventById = new Map(season.events.map((e) => [e.id, e]))
  const filtered = season.scheduled_events.filter((e) => e.conference === conference)

  const seen = new Set<string>()
  const matches: UpcomingMatch[] = []
  for (const ev of filtered) {
    const key = `${ev.event_id}|${ev.starts_at}|${ev.conference}`
    if (seen.has(key)) continue
    seen.add(key)
    const template = eventById.get(ev.event_id)
    if (!template) continue
    let mapName: string
    let mapId: string
    if (template.type === 'TOURNAMENT' && template.map_selection.type === 'PICKBAN') {
      mapName = `pool: ${template.map_selection.maps.map((m) => m.name).join(', ')}`
      mapId = ''
    } else {
      const first = template.map_selection.maps[0]
      mapName = first?.name ?? 'TBD'
      mapId = first?.id ?? ''
    }
    matches.push({
      matchTimeStart: Date.parse(ev.starts_at),
      matchTimeEnd: Date.parse(ev.ends_at),
      eventType: template.type,
      mapName,
      mapId,
      conference: ev.conference,
      seasonId: season.id,
    })
  }

  matches.sort((a, b) => a.matchTimeStart - b.matchTimeStart)
  return matches.slice(0, limit)
}
