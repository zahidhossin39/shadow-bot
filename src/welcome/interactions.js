// Click handlers for the welcome message buttons.
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { addGreet } from './greetStore.js';
import { channelMention, config, welcomeButtons } from './message.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

async function onGreet(interaction, memberId) {
  if (interaction.user.id === memberId) {
    return interaction.reply({ content: "You can't welcome yourself, but welcome anyway. 👋", ...EPHEMERAL });
  }
  const { added, count } = addGreet(interaction.message.id, interaction.user.id);
  if (!added) {
    return interaction.reply({ content: 'You already welcomed them. 👋', ...EPHEMERAL });
  }
  // update() edits the message the button lives on, so the counter goes up for everyone.
  await interaction.update({ components: [welcomeButtons(memberId, count)] });
  await interaction.followUp({ content: `You welcomed <@${memberId}> to the garden. 🌙`, ...EPHEMERAL, allowedMentions: { parse: [] } });
}

async function onRules(interaction) {
  const list = config.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle('📜 Rules of the Garden')
    .setDescription(`${list}\n\nFull rules: ${channelMention(interaction.guild, config.channels.rules)}`);
  await interaction.reply({ embeds: [embed], ...EPHEMERAL });
}

/** Returns true if the interaction was one of ours. */
export async function handleWelcomeInteraction(interaction) {
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  if (id.startsWith('greet:')) return (await onGreet(interaction, id.slice(6)), true);
  if (id === 'rules:show') return (await onRules(interaction), true);
  return false;
}
