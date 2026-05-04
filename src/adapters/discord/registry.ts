import type { SlashCommand } from './command.js'

export type CommandRegistry = Map<string, SlashCommand>

export const buildRegistry = (commands: SlashCommand[]): CommandRegistry => {
  const m = new Map<string, SlashCommand>()
  for (const c of commands) {
    if (m.has(c.data.name)) throw new Error(`duplicate command: ${c.data.name}`)
    m.set(c.data.name, c)
  }
  return m
}
