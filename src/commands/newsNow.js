import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { postEdition } from '../news/scheduler.js';

export const data = new SlashCommandBuilder()
  .setName('news-now')
  .setDescription('Post a news edition to the news channel right now')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  // Fetching feeds and article pages takes several seconds.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const count = await postEdition(interaction.client);
  await interaction.editReply(count ? `Posted ${count} stories. 🗞️` : 'No new stories right now (or an edition is already posting).');
}
