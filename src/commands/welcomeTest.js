import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildWelcomeMessage } from '../welcome/message.js';

export const data = new SlashCommandBuilder()
  .setName('welcome-test')
  .setDescription('Preview the welcome message on yourself (only you can see it)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  // Rendering the card can take longer than Discord's 3-second reply window, so defer first.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const payload = await buildWelcomeMessage(interaction.member);
  await interaction.editReply({ ...payload, allowedMentions: { parse: [] } });
}
