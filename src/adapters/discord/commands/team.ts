import { SlashCommandBuilder } from 'discord.js'
import { setTeamConfig } from '../../../app/setTeamConfig.js'
import { isErr } from '../../../domain/result.js'
import type { TeamRepository } from '../../../ports/repositories.js'
import type { SlashCommand } from '../command.js'

export const teamCommand = (teamRepo: TeamRepository): SlashCommand => ({
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage team configuration (captain only).')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set a team config value.')
        .addStringOption((o) =>
          o
            .setName('field')
            .setDescription('Which field to set.')
            .setRequired(true)
            .addChoices(
              { name: 'region', value: 'region' },
              { name: 'conference', value: 'conference' },
              { name: 'henrik-team-id', value: 'henrik_team_id' },
              { name: 'captain-role', value: 'captain_role' },
              { name: 'member-role', value: 'member_role' },
              { name: 'channel', value: 'channel' },
            ),
        )
        .addStringOption((o) =>
          o.setName('string-value').setDescription('Plain string value.'),
        )
        .addRoleOption((o) =>
          o.setName('role-value').setDescription('Role value (for role fields).'),
        )
        .addChannelOption((o) =>
          o.setName('channel-value').setDescription('Channel value (for channel field).'),
        ),
    )
    .addSubcommand((s) =>
      s.setName('show').setDescription('Show the current team configuration.'),
    ) as unknown as SlashCommandBuilder,
  permission: 'captain',
  execute: async (interaction) => {
    if (!interaction.guildId) return
    const sub = interaction.options.getSubcommand()

    if (sub === 'show') {
      const t = teamRepo.findByGuild(interaction.guildId)
      if (isErr(t) || !t.value) {
        await interaction.reply({
          ephemeral: true,
          content: 'No team config yet. Use `/team set` to configure.',
        })
        return
      }
      const v = t.value
      await interaction.reply({
        ephemeral: true,
        content:
          `**Team config**\n` +
          `region: ${v.region ?? '(unset)'}\n` +
          `conference: ${v.conference ?? '(unset)'}\n` +
          `henrik_team_id: ${v.henrikTeamId ?? '(unset)'}\n` +
          `captain role: ${v.captainRoleId ? `<@&${v.captainRoleId}>` : '(unset)'}\n` +
          `member role: ${v.memberRoleId ? `<@&${v.memberRoleId}>` : '(unset)'}\n` +
          `announcements channel: ${v.announcementsChannelId ? `<#${v.announcementsChannelId}>` : '(unset)'}`,
      })
      return
    }

    const field = interaction.options.getString('field', true)
    const stringValue = interaction.options.getString('string-value')
    const roleValue = interaction.options.getRole('role-value')
    const channelValue = interaction.options.getChannel('channel-value')

    const input: Parameters<typeof setTeamConfig>[1] = { guildId: interaction.guildId }
    switch (field) {
      case 'region':
        if (!stringValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide string-value (region).' })
          return
        }
        input.region = stringValue
        break
      case 'conference':
        if (!stringValue) {
          await interaction.reply({
            ephemeral: true,
            content: 'Provide string-value (e.g. NA_US_WEST).',
          })
          return
        }
        input.conference = stringValue
        break
      case 'henrik_team_id':
        if (!stringValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide string-value.' })
          return
        }
        input.henrikTeamId = stringValue
        break
      case 'captain_role':
        if (!roleValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide role-value.' })
          return
        }
        input.captainRoleId = roleValue.id
        break
      case 'member_role':
        if (!roleValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide role-value.' })
          return
        }
        input.memberRoleId = roleValue.id
        break
      case 'channel':
        if (!channelValue) {
          await interaction.reply({ ephemeral: true, content: 'Provide channel-value.' })
          return
        }
        input.announcementsChannelId = channelValue.id
        break
    }

    const r = setTeamConfig(teamRepo, input)
    if (isErr(r)) {
      const msg =
        r.error.tag === 'validation' ? `Invalid: ${r.error.message}` : 'Failed to update.'
      await interaction.reply({ ephemeral: true, content: msg })
      return
    }
    await interaction.reply({ ephemeral: true, content: `Updated \`${field}\`.` })
  },
})
