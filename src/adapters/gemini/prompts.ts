import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CoachPlayerInput, CoachTeamInput } from '../../ports/aiCoach.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

let cachedRoleCriteria: string | null = null
const loadRoleCriteria = (): string => {
  if (cachedRoleCriteria === null) {
    cachedRoleCriteria = readFileSync(resolve(root, 'prompts/role-criteria.md'), 'utf8')
  }
  return cachedRoleCriteria
}

export const PROMPT_VERSION = 'v1.0'

export const buildPlayerPrompt = (input: CoachPlayerInput): string => {
  const criteria = loadRoleCriteria()
  const roleNote = input.preRoleAssignment
    ? '\nNOTE: This player has no assigned role yet. Use the **Flex** rubric and choose the role rubric closest to the agent they played. Mention this fact briefly in the public focus_area.'
    : ''
  return [
    `# Valorant Premier Match Coaching — Player`,
    `Prompt version: ${PROMPT_VERSION}`,
    ``,
    `You are a candid, experienced Valorant coach reviewing one player's match in a single Premier game.`,
    `Produce two coaching blocks for this player based on the match data:`,
    `- **public**: blameless, team-safe, focused on highlight + one focus area. Posted in a team thread.`,
    `- **private**: candid, direct, multiple did_well/improve items, role-specific tip. DM'd to the player only.`,
    ``,
    `## Player`,
    `- riot_name: ${input.riotName}`,
    `- puuid: ${input.puuid}`,
    `- assigned_role: ${input.role}${roleNote}`,
    ``,
    `## Match (Henrik raw payload)`,
    '```json',
    input.matchRawJson,
    '```',
    ``,
    `## Role-Involvement Rubric`,
    criteria,
    ``,
    `## Output Rules`,
    `- Output strict JSON matching the provided schema. No prose outside JSON.`,
    `- public.tldr <= 160 chars; public.role_involvement_one_liner <= 100 chars.`,
    `- private.tldr <= 200 chars; private.did_well 1-3 items; private.improve 1-3 items.`,
    `- private.role_involvement.criteria entries: name, score_pct (0-100), evidence (<=140 chars).`,
    `- public.role_involvement_pct must equal private.role_involvement.pct.`,
    `- evidence must reference concrete observable match details (rounds, agent abilities, kill/death events).`,
  ].join('\n')
}

export const buildTeamPrompt = (input: CoachTeamInput): string => {
  return [
    `# Valorant Premier Match Coaching — Team`,
    `Prompt version: ${PROMPT_VERSION}`,
    ``,
    `You are a candid, experienced Valorant coach reviewing a team's Premier match.`,
    `Produce a public, team-level coaching summary based on the match data.`,
    ``,
    `## Match (Henrik raw payload)`,
    '```json',
    input.matchRawJson,
    '```',
    ``,
    `## Output Rules`,
    `- Strict JSON only.`,
    `- tldr: 1-2 sentence overview, blameless framing.`,
    `- what_worked: 2-4 short concrete items.`,
    `- what_to_fix: 2-4 short concrete items.`,
    `- next_match_focus: 1 specific actionable focus for the next game.`,
  ].join('\n')
}

export const hashPrompt = (prompt: string): string =>
  createHash('sha256').update(prompt).digest('hex').slice(0, 16)
