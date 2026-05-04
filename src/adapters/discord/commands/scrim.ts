import { SlashCommandBuilder } from 'discord.js'
import { parseDateTime } from '../../../app/parseDateTime.js'
import { isErr, isOk } from '../../../domain/result.js'
import type { ScrimsRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const scrimCommand = (scrimRepo: ScrimsRepository): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('scrim')
    .setDescription('Propose, list, or cancel scrims.')
    .addSubcommand((s) =>
      s
        .setName('propose')
        .setDescription('Propose a new scrim.')
        .addStringOption((o) => o.setName('date').setDescription('YYYY-MM-DD').setRequired(true))
        .addStringOption((o) =>
          o.setName('time').setDescription('HH:MM (24h, server local time)').setRequired(true),
        )
        .addStringOption((o) => o.setName('note').setDescription('Optional note')),
    )
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('Cancel a scrim by id (captain).')
        .addIntegerOption((o) => o.setName('id').setDescription('Scrim id').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List open scrims.'),
    ) as unknown as SlashCommandBuilder,
  permission: 'member',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'propose') {
      const date = interaction.options.getString('date', true)
      const time = interaction.options.getString('time', true)
      const note = interaction.options.getString('note')
      const parsed = parseDateTime(date, time)
      if (isErr(parsed)) {
        const msg =
          parsed.error.tag === 'in_past'
            ? 'Scrim time is in the past.'
            : 'Use `YYYY-MM-DD` for date and `HH:MM` (24h) for time.'
        await interaction.reply({ ephemeral: true, content: msg })
        return
      }
      const ins = scrimRepo.insert({
        guildId: interaction.guildId,
        proposedBy: interaction.user.id,
        startAt: parsed.value,
        status: 'proposed',
        messageId: null,
        note: note?.slice(0, 200) ?? null,
        createdAt: Date.now(),
      })
      if (isErr(ins)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to create scrim.' })
        return
      }
      await interaction.reply({
        content: `**Scrim #${ins.value}** proposed for <t:${Math.floor(parsed.value / 1000)}:F> by <@${interaction.user.id}>${note ? `\n_${note}_` : ''}\nReact ✅/❌/❓ to RSVP.`,
        allowedMentions: { parse: [] },
      })
      try {
        const reply = await interaction.fetchReply()
        scrimRepo.setMessageId(ins.value, reply.id)
        await reply.react('✅')
        await reply.react('❌')
        await reply.react('❓')
      } catch {
        // Ignore reaction failures; RSVP via /scrim rsvp could be added later.
      }
      return
    }

    if (sub === 'cancel') {
      const id = interaction.options.getInteger('id', true)
      const found = scrimRepo.findById(id)
      if (isErr(found) || !found.value || found.value.guildId !== interaction.guildId) {
        await interaction.reply({ ephemeral: true, content: `Scrim #${id} not found.` })
        return
      }
      const r = scrimRepo.setStatus(id, 'cancelled')
      await interaction.reply({
        ephemeral: true,
        content: isOk(r) ? `Scrim #${id} cancelled.` : 'Failed to cancel.',
      })
      return
    }

    if (sub === 'list') {
      const open = scrimRepo.listOpenByGuild(interaction.guildId)
      if (isErr(open)) {
        await interaction.reply({ ephemeral: true, content: 'Failed to list scrims.' })
        return
      }
      if (open.value.length === 0) {
        await interaction.reply({ ephemeral: true, content: 'No open scrims.' })
        return
      }
      const lines = open.value.map(
        (s) =>
          `#${s.id} — <t:${Math.floor(s.startAt / 1000)}:F> — ${s.status}${s.note ? ` — ${s.note}` : ''}`,
      )
      await interaction.reply({ ephemeral: true, content: lines.join('\n') })
      return
    }
  },
})

export const isCaptainOnlyScrimSubcommand = (sub: string): boolean => sub === 'cancel'
