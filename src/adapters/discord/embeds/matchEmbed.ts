import type { APIEmbed } from 'discord.js'
import type { MatchDetail } from '../../../ports/matchData.js'

const RESULT_COLOR: Record<MatchDetail['result'], number> = {
  win: 0x2ecc71,
  loss: 0xe74c3c,
  draw: 0x95a5a6,
  no_result: 0x7f8c8d,
}

export const buildMatchEmbed = (m: MatchDetail): APIEmbed => {
  const ours = m.scoreboard
    .filter((p) => m.ourPuuids.has(p.puuid))
    .sort((a, b) => b.kills - a.kills)
  const lines = ours.map(
    (p) =>
      `**${p.riotName}#${p.riotTag}** — ${p.agent} • ${p.kills}/${p.deaths}/${p.assists} • HS ${p.hsPct.toFixed(1)}%`,
  )
  return {
    title: `${m.result.toUpperCase()} — ${m.map} ${m.scoreUs}-${m.scoreThem}`,
    description: lines.join('\n') || '_no scoreboard data_',
    color: RESULT_COLOR[m.result],
    timestamp: new Date(m.playedAt).toISOString(),
    footer: { text: `match ${m.matchId}` },
  }
}
