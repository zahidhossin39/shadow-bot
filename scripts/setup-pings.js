// Sets up opt-in notifications: creates each ping role and the notifications channel if missing,
// posts (or updates) the button panel there, and saves the new IDs into config.json.
// Re-run after editing config.pings: it edits the existing panel instead of posting a new one.
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { config, findChannel } from '../src/welcome/message.js';
import { panelMessage } from '../src/pings/panel.js';

const CHANNEL_NAME = '🔔・ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴs';
const CONFIG = new URL('../config.json', import.meta.url);

/** Write one value into config.json without reformatting the rest (keeps emoji and layout). */
function saveId(pattern, id) {
  const text = readFileSync(CONFIG, 'utf8');
  const next = text.replace(pattern, (m, head) => `${head}"${id}"`);
  if (next === text) throw new Error(`could not save ${id} into config.json`);
  writeFileSync(CONFIG, next);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  try {
    const guild = client.guilds.cache.first();
    const me = guild.members.me;
    for (const p of ['ManageRoles', 'ManageChannels', 'MentionEveryone']) {
      if (!me.permissions.has(PermissionFlagsBits[p])) console.warn(`[${guild.name}] bot is missing "${p}"`);
    }

    for (const option of config.pings.options) {
      let role = guild.roles.cache.get(option.role) ?? guild.roles.cache.find((r) => r.name === option.roleName);
      if (!role) {
        // Not mentionable by members, so only the bot (Mention Everyone) can ping it.
        role = await guild.roles.create({ name: option.roleName, mentionable: false, permissions: [], reason: 'Opt-in notifications' });
        console.log(`[${guild.name}] created role ${role.name}`);
      }
      if (option.role !== role.id) {
        saveId(new RegExp(`("key": "${option.key}"[\\s\\S]*?"role": )"[^"]*"`), role.id);
        option.role = role.id;
      }
    }

    let channel = findChannel(guild, config.pings.channel);
    if (!channel) {
      const parent = findChannel(guild, config.channels.rules)?.parent ?? null;
      channel = await guild.channels.create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        parent,
        topic: 'Pick which channels ping you. Everything is off by default.',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages', 'AddReactions', 'CreatePublicThreads'] },
          { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks'] },
        ],
        reason: 'Opt-in notifications',
      });
      console.log(`[${guild.name}] created #${channel.name}`);
      saveId(/("pings": \{\s*"channel": )"[^"]*"/, channel.id);
      config.pings.channel = channel.id;
    }

    const mine = (await channel.messages.fetch({ limit: 20 })).find((m) => m.author.id === client.user.id);
    if (mine) await mine.edit(panelMessage());
    else await channel.send(panelMessage());
    console.log(`[${guild.name}] ${mine ? 'updated' : 'posted'} the notification panel in #${channel.name}`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(process.env.DISCORD_TOKEN);
