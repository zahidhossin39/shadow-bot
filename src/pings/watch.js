// Channel pings: when a member posts in a channel someone opted into, the bot drops a small
// "New in #channel" line that mentions that channel's role. A cooldown per channel stops a busy
// channel (like the chat room) from pinging on every message.
import { Events } from 'discord.js';
import { config } from '../welcome/message.js';

const lastPing = new Map(); // channel id -> time of the last ping

export function startChannelPings(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.system) return;
    const option = config.pings?.options.find((p) => p.channel === message.channelId && p.watch !== false && p.role);
    if (!option) return;
    const now = Date.now();
    if (now - (lastPing.get(option.channel) ?? 0) < (option.cooldownMinutes ?? 30) * 60_000) return;
    lastPing.set(option.channel, now);
    try {
      await message.channel.send({
        content: `-# 🔔 New in <#${option.channel}> · <@&${option.role}> · turn off in <#${config.pings.channel}>`,
        allowedMentions: { parse: [], roles: [option.role] },
      });
    } catch (err) {
      console.error(`[pings] could not ping in #${message.channel.name}:`, err.message);
    }
  });
}
