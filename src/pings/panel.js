// Opt-in notifications ("ping roles").
// Everyone is on "Only @mentions" by default, so nobody is pinged. In the notifications channel,
// members click a button to get or drop a role; posts that mention that role ping only them.
// Bots can't change anyone's own notification settings, so a role is the only way to do this.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from '../welcome/message.js';

const pings = () => config.pings?.options ?? [];

export function panelMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x7f77dd)
    .setTitle('🔔 Notification settings')
    .setDescription(
      [
        'Notifications are **off** for everyone by default. Pick what you want to be pinged for.',
        'Click a button to turn it **on**, click again to turn it **off**.',
        '',
        ...pings().map((p) => `${p.emoji} **${p.label}** (<#${p.channel}>): ${p.description}`),
      ].join('\n'),
    );
  // Discord allows 5 buttons per row and 5 rows, so up to 25 options.
  const buttons = pings().map((p) => new ButtonBuilder().setCustomId(`ping:${p.key}`).setLabel(p.label).setEmoji(p.emoji).setStyle(ButtonStyle.Secondary));
  const rows = [];
  for (let i = 0; i < buttons.length && rows.length < 5; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  return { embeds: [embed], components: rows };
}

/** Handles "ping:<key>" buttons. Returns true if it was one of ours. */
export async function handlePingInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('ping:')) return false;
  const option = pings().find((p) => p.key === interaction.customId.slice(5));
  const role = option && interaction.guild.roles.cache.get(option.role);
  if (!role) {
    await interaction.reply({ content: 'That option is not set up yet. Tell a moderator.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const member = interaction.member;
  const has = member.roles.cache.has(role.id);
  if (has) await member.roles.remove(role, 'Turned off in notification settings');
  else await member.roles.add(role, 'Turned on in notification settings');
  await interaction.reply({
    content: has ? `🔕 **${option.label}** notifications are now **off**.` : `🔔 **${option.label}** notifications are now **on**. Click again any time to turn them off.`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

/** "<@&role>" for a ping option, or '' if it isn't set up. */
export function pingMention(key) {
  const role = pings().find((p) => p.key === key)?.role;
  return role ? `<@&${role}>` : '';
}
