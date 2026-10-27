import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'node:fs';
import { renderWelcomeCard } from '../card/welcomeCard.js';

export const config = JSON.parse(readFileSync(new URL('../../config.json', import.meta.url), 'utf8'));

// Config values can be a channel ID or a channel name, so renaming a channel only needs a config edit.
export function findChannel(guild, ref) {
  if (!ref) return null;
  if (/^\d+$/.test(ref)) return guild.channels.cache.get(ref) ?? null;
  return guild.channels.cache.find((c) => c.name === ref) ?? null;
}

// Clickable #channel mention if it exists, plain text otherwise.
function channelMention(guild, ref) {
  const ch = findChannel(guild, ref);
  return ch ? `<#${ch.id}>` : `#${ref}`;
}

/**
 * Build the full welcome message (text, embed, card image) for a member.
 * Shared by the join event and /welcome-test so the preview is exactly what joiners see.
 */
export async function buildWelcomeMessage(member) {
  const { guild } = member;
  const memberNumber = guild.memberCount;
  const { channels, text } = config;

  const png = await renderWelcomeCard({
    avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
    username: member.displayName,
    memberNumber,
    joinedAt: member.joinedAt ?? new Date(),
  });
  const file = new AttachmentBuilder(png, { name: 'welcome.png' });

  const steps = [
    `**Step 1** · Read ${channelMention(guild, channels.rules)}`,
    `**Step 2** · Learn in ${channelMention(guild, channels.guides)}`,
    `**Step 3** · Say hi in ${channelMention(guild, channels.chat)}`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: `SHADOW GARDEN · MEMBER #${memberNumber}` })
    .setTitle(text.title)
    .setDescription(`${text.lore}\n\n${steps}`)
    .setImage('attachment://welcome.png')
    .setFooter({ text: text.footer });

  return {
    content: text.joinLine.replace('{user}', `<@${member.id}>`),
    embeds: [embed],
    files: [file],
    // Ping only the new member, never @everyone or roles.
    allowedMentions: { users: [member.id] },
  };
}
