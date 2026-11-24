// Silent "new news" marker: when an edition goes up, the news channel's 📰 becomes 🆕 for 20 hours.
// Renaming a channel sends no notification, but everyone sees it in the channel list.
// Works for Gemini's editions too: the Worker posts with the same bot account.
import { Events } from 'discord.js';
import { config, findChannel } from '../welcome/message.js';

const FRESH_HOURS = 20;
const NORMAL = '📰';
const FRESH = '🆕';
const isHeader = (m) => m.author.id === m.client.user.id && m.content.startsWith('## 🗞️');

/** True if an edition (Gemini's or the bot's) was posted in the last 20 hours. */
export async function recentEdition(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const since = Date.now() - FRESH_HOURS * 3_600_000;
  return messages.some((m) => isHeader(m) && m.createdTimestamp > since);
}

async function setFresh(channel, fresh) {
  const name = fresh ? channel.name.replace(new RegExp(`^${NORMAL}`), FRESH) : channel.name.replace(new RegExp(`^${FRESH}`), NORMAL);
  if (name === channel.name) return;
  await channel.setName(name, fresh ? 'New news edition' : 'News edition is a day old');
  console.log(`[news] channel renamed to ${name}`);
}

/** Make every news channel's badge match whether there's a fresh edition. */
async function sync(client) {
  for (const guild of client.guilds.cache.values()) {
    const channel = findChannel(guild, config.news.channel);
    if (!channel) continue;
    try {
      await setFresh(channel, await recentEdition(channel));
    } catch (err) {
      console.error(`[news] [${guild.name}] badge update failed:`, err.message);
    }
  }
}

export function startBadge(client) {
  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== config.news.channel || !isHeader(message)) return;
    setFresh(message.channel, true).catch((err) => console.error('[news] badge update failed:', err.message));
  });
  sync(client);
  setInterval(() => sync(client), 10 * 60_000);
}
