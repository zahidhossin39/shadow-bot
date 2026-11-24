// Renames the rules channel to "⚖️・ʀᴜʟᴇs-ᴀɴᴅ-ɢᴜɪᴅᴀɴᴄᴇ" and posts the Rules & Guidance embed there.
// Re-run after editing rules in config.json: it edits the bot's existing post instead of adding a new one.
import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { findChannel, normalizeName, rulesEmbed } from '../src/welcome/message.js';

const NEW_NAME = '⚖️・ʀᴜʟᴇs-ᴀɴᴅ-ɢᴜɪᴅᴀɴᴄᴇ';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  try {
    for (const guild of client.guilds.cache.values()) {
      const channel = findChannel(guild, 'rules-and-guidance') ?? guild.channels.cache.find((c) => normalizeName(c.name) === 'rules');
      if (!channel) {
        console.warn(`[${guild.name}] no rules channel found`);
        continue;
      }
      if (channel.name !== NEW_NAME) {
        await channel.setName(NEW_NAME, 'Rules → Rules & Guidance');
        console.log(`[${guild.name}] renamed channel to #${NEW_NAME}`);
      }
      if (!channel.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages)) {
        console.warn(`[${guild.name}] can't post: give Shadow Bot "Send Messages" in #${channel.name}, then run this again`);
        continue;
      }
      const payload = { embeds: [rulesEmbed(guild)] };
      const mine = (await channel.messages.fetch({ limit: 20 })).find((m) => m.author.id === client.user.id);
      if (mine) await mine.edit(payload);
      else await channel.send(payload);
      console.log(`[${guild.name}] ${mine ? 'updated' : 'posted'} Rules & Guidance`);
    }
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});
client.login(process.env.DISCORD_TOKEN);
