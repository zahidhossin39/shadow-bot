// Click handlers for the welcome message buttons and the role picker.
import { ActionRowBuilder, EmbedBuilder, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import { addGreet } from './greetStore.js';
import { channelMention, config, findRole, welcomeButtons } from './message.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// Interest roles from config that actually exist on this server.
function interestRoles(guild) {
  return config.interestRoles
    .map((r) => ({ ...r, found: findRole(guild, r.role) }))
    .filter((r) => r.found);
}

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

async function onRolesOpen(interaction) {
  const roles = interestRoles(interaction.guild);
  if (!roles.length) {
    return interaction.reply({ content: 'No interest roles are set up yet. Ask a moderator.', ...EPHEMERAL });
  }
  const has = interaction.member.roles.cache;
  const menu = new StringSelectMenuBuilder()
    .setCustomId('roles:pick')
    .setPlaceholder('Choose your paths…')
    .setMinValues(0)
    .setMaxValues(roles.length)
    .addOptions(
      roles.map((r) => ({
        label: r.found.name,
        value: r.found.id,
        description: r.description,
        emoji: r.emoji,
        default: has.has(r.found.id),
      })),
    );
  await interaction.reply({
    content: 'Pick the paths you want to follow. Unselect one to leave it.',
    components: [new ActionRowBuilder().addComponents(menu)],
    ...EPHEMERAL,
  });
}

async function onRolesPick(interaction) {
  // Only touch roles that are in the menu, never anything else the member has.
  const offered = interestRoles(interaction.guild).map((r) => r.found.id);
  const chosen = new Set(interaction.values);
  const has = interaction.member.roles.cache;
  const toAdd = offered.filter((id) => chosen.has(id) && !has.has(id));
  const toRemove = offered.filter((id) => !chosen.has(id) && has.has(id));

  try {
    if (toAdd.length) await interaction.member.roles.add(toAdd);
    if (toRemove.length) await interaction.member.roles.remove(toRemove);
  } catch (err) {
    console.error('[roles] update failed:', err.message);
    return interaction.update({
      content: "I couldn't change your roles. A moderator needs to move the bot's role above these roles.",
      components: [],
    });
  }

  const names = offered.filter((id) => chosen.has(id)).map((id) => `<@&${id}>`);
  await interaction.update({
    content: names.length ? `Your paths: ${names.join(' ')}` : 'You left all interest paths.',
    components: [],
    allowedMentions: { parse: [] },
  });
}

/** Returns true if the interaction was one of ours. */
export async function handleWelcomeInteraction(interaction) {
  const id = interaction.customId ?? '';
  if (interaction.isButton()) {
    if (id.startsWith('greet:')) return (await onGreet(interaction, id.slice(6)), true);
    if (id === 'rules:show') return (await onRules(interaction), true);
    if (id === 'roles:open') return (await onRolesOpen(interaction), true);
  }
  if (interaction.isStringSelectMenu() && id === 'roles:pick') return (await onRolesPick(interaction), true);
  return false;
}
