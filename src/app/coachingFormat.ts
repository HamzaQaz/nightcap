import type { PlayerCoaching, TeamCoaching } from '../ports/aiCoach.js'

export const formatPlayerPublic = (
  discordId: string,
  c: PlayerCoaching['public'],
  options: { preRoleNote?: string } = {},
): string => {
  const lines = [
    `<@${discordId}> — coaching summary`,
    `**TL;DR**: ${c.tldr}`,
    `**Highlight**: ${c.highlight}`,
    `**Focus area**: ${c.focus_area}`,
    `**Role involvement**: ${c.role_involvement_pct}% — ${c.role_involvement_one_liner}`,
  ]
  if (options.preRoleNote) lines.push(options.preRoleNote)
  return lines.join('\n')
}

export const formatPlayerPrivate = (matchId: string, c: PlayerCoaching['private']): string => {
  const didWell = c.did_well.map((s) => `- ${s}`).join('\n')
  const improve = c.improve.map((s) => `- ${s}`).join('\n')
  const criteria = c.role_involvement.criteria
    .map((k) => `- **${k.name}** (${k.score_pct}%): ${k.evidence}`)
    .join('\n')
  return [
    `Coaching DM — match \`${matchId}\``,
    ``,
    `**TL;DR**: ${c.tldr}`,
    ``,
    `**Did well**`,
    didWell,
    ``,
    `**Improve**`,
    improve,
    ``,
    `**Coaching tip**: ${c.coaching_tip}`,
    ``,
    `**Role involvement** — ${c.role_involvement.pct}%`,
    criteria,
  ].join('\n')
}

export const formatTeam = (c: TeamCoaching): string => {
  const worked = c.what_worked.map((s) => `- ${s}`).join('\n')
  const fix = c.what_to_fix.map((s) => `- ${s}`).join('\n')
  return [
    `**Team coaching**`,
    ``,
    `${c.tldr}`,
    ``,
    `**What worked**`,
    worked,
    ``,
    `**What to fix**`,
    fix,
    ``,
    `**Next match focus**: ${c.next_match_focus}`,
  ].join('\n')
}

export const PRE_ROLE_PUBLIC_NOTE =
  '_No assigned role yet — captain, set one with `/roster set-role` for sharper coaching._'
