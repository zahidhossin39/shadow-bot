import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'node:fs';
import { renderWelcomeCard } from '../card/welcomeCard.js';

export const config = JSON.parse(readFileSync(new URL('../../config.json', import.meta.url), 'utf8'));

// Small-caps letters the server uses in channel names (ᴡᴇʟᴄᴏᴍᴇ), mapped back to plain ASCII.
const SMALL_CAPS = {
  ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm',
  ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
};

// "👋・ᴡᴇʟᴄᴏᴍᴇ-ᴛᴏ-sʜᴀᴅᴏᴡ-ɢʀᴀᴅᴇɴ" → "welcome-to-shadow-graden", so config can use plain names.
export function normalizeName(name) {
  return [...name]
    .map((ch) => SMALL_CAPS[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

// Config values can be a channel ID or a plain channel name, so renaming a channel only needs a config edit.
export function findChannel(guild, ref) {
  if (!ref) return null;
  if (/^\d+$/.test(ref)) return guild.channels.cache.get(ref) ?? null;
  const target = normalizeName(ref);
  return guild.channels.cache.find((c) => c.isTextBased?.() !== false && normalizeName(c.name) === target) ?? null;
}

// Same idea for roles: config uses plain names ("AI"), the server may style them.
export function findRole(guild, ref) {
  if (!ref) return null;
  if (/^\d+$/.test(ref)) return guild.roles.cache.get(ref) ?? null;
  const target = normalizeName(ref);
  return guild.roles.cache.find((r) => normalizeName(r.name) === target) ?? null;
}

// Clickable #channel mention if it exists, plain text otherwise.
export function channelMention(guild, ref) {
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
    components: [welcomeButtons(member.id, 0)],
    // Ping only the new member, never @everyone or roles.
    allowedMentions: { users: [member.id] },
  };
}

/**
 * Goodbye message: the faded card plus a short embed. No ping, since they've already left.
 * Works on partial members (left before the bot cached them), so it only relies on member.user.
 */
export async function buildGoodbyeMessage(member) {
  const { user, guild } = member;
  const name = member.displayName ?? user.globalName ?? user.username;

  const png = await renderWelcomeCard({
    avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 }),
    username: name,
    memberNumber: guild.memberCount,
    joinedAt: new Date(),
    faded: true,
  });
  const file = new AttachmentBuilder(png, { name: 'goodbye.png' });

  const embed = new EmbedBuilder()
    .setColor(config.goodbyeColor)
    .setTitle(config.text.goodbyeTitle.replace('{name}', name))
    .setDescription(config.text.goodbyeLine)
    .setImage('attachment://goodbye.png')
    .setFooter({ text: `${guild.memberCount} shadows remain` });

  return { embeds: [embed], files: [file], allowedMentions: { parse: [] } };
}

// Button custom IDs carry the new member's ID so a click knows who is being welcomed,
// even after a bot restart.
export function welcomeButtons(memberId, count) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`greet:${memberId}`)
      .setLabel(`Welcome them (${count})`)
      .setEmoji('👋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('roles:open').setLabel('Pick roles').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rules:show').setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary),
  );
}
