// Fallback edition: Gemini posts the daily top 10 at 2 PM Dhaka time through the Shadow News Worker.
// At each configured time (16:00; Gemini runs ~30 min late) the bot posts an RSS edition only if no edition was posted in the last 20 hours.
// Checks once a minute; if the bot was offline at a posting time, it catches up at startup.
import { config, findChannel } from '../welcome/message.js';
import { collectStories, editionHeader, storyEmbed } from './edition.js';
import { recentEdition } from './badge.js';
import { lastSlot, markPosted, setLastSlot } from './newsStore.js';

const news = config.news;

/** "2026-11-04 09:00" for the given moment, in the news timezone. */
function localStamp(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: news.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The most recent posting time that has already passed, e.g. "2026-11-04 15:00". */
export function currentSlot(now = new Date()) {
  const { day, time } = localStamp(now);
  const times = [...news.times].sort();
  const passed = times.filter((t) => t <= time);
  if (passed.length) return `${day} ${passed.at(-1)}`;
  // Before the first time today: the last edition was yesterday evening.
  return `${localStamp(new Date(now.getTime() - 86_400_000)).day} ${times.at(-1)}`;
}

let running = false;


/** Post one edition to the news channel of every server. Returns how many stories were posted. */
export async function postEdition(client, { fallback = false } = {}) {
  if (running) return 0;
  running = true;
  try {
    const channels = [];
    for (const guild of client.guilds.cache.values()) {
      const channel = findChannel(guild, news.channel);
      if (!channel) console.warn(`[news] [${guild.name}] channel "${news.channel}" not found`);
      else if (fallback && (await recentEdition(channel))) console.log(`[news] [${guild.name}] Gemini edition already posted, skipping fallback`);
      else channels.push(channel);
    }
    if (!channels.length) return 0;
    const stories = await collectStories();
    if (!stories.length) {
      console.log('[news] no new stories this time');
      return 0;
    }
    for (const channel of channels) {
      await channel.send(editionHeader());
      // One message per story, so every story gets its own big image.
      for (const story of stories) await channel.send({ embeds: [storyEmbed(story)] });
    }
    markPosted(stories.map((s) => s.link));
    console.log(`[news] posted ${stories.length} stories`);
    return stories.length;
  } finally {
    running = false;
  }
}

export function startNews(client) {
  const tick = async () => {
    const slot = currentSlot();
    if (slot === lastSlot() || running) return;
    console.log(`[news] edition ${slot}`);
    try {
      await postEdition(client, { fallback: true });
      setLastSlot(slot);
    } catch (err) {
      console.error('[news] edition failed, will retry next minute:', err);
    }
  };
  tick();
  setInterval(tick, 60_000);
}
