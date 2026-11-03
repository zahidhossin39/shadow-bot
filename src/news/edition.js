// Picks the newest unposted stories per category and turns each into a Discord embed.
import { EmbedBuilder } from 'discord.js';
import { config } from '../welcome/message.js';
import { fetchFeed, pageImage } from './feeds.js';
import { isPosted } from './newsStore.js';

const news = config.news;

/** Newest first, but alternating sources, so one busy site can't fill a whole category. */
function interleave(lists) {
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

export async function collectStories() {
  const cutoff = Date.now() - news.maxAgeHours * 3_600_000;
  const stories = [];

  for (const category of news.categories) {
    const results = await Promise.allSettled(category.feeds.map(fetchFeed));
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn(`[news] ${category.feeds[i].name} failed: ${r.reason.message}`);
    });
    const perFeed = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) =>
        r.value
          .filter((s) => !isPosted(s.link) && (!s.date || s.date.getTime() >= cutoff))
          .sort((a, b) => (b.date ?? 0) - (a.date ?? 0)),
      );
    // Some sites (e.g. TechCrunch) also show up in another feed: skip duplicate links.
    const seen = new Set(stories.map((s) => s.link));
    const picked = interleave(perFeed).filter((s) => !seen.has(s.link)).slice(0, news.perCategory);
    for (const s of picked) stories.push({ ...s, category });
  }

  // The page's own preview image is sharper than most feed thumbnails; the feed image is the fallback.
  await Promise.all(stories.map(async (s) => (s.image = (await pageImage(s.link)) ?? s.image)));
  return stories;
}

export function storyEmbed(story) {
  const embed = new EmbedBuilder()
    .setColor(story.category.color)
    .setAuthor({ name: `${story.category.emoji} ${story.category.name} · ${story.source}` })
    .setTitle(story.title.slice(0, 256))
    .setURL(story.link);
  if (story.summary) embed.setDescription(story.summary);
  if (story.image) embed.setImage(story.image);
  if (story.date) embed.setTimestamp(story.date);
  return embed;
}

/** "🗞️ Morning edition · Tuesday, 4 November" in the news timezone. */
export function editionHeader(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: news.timezone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const name = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: news.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return `## 🗞️ ${name} edition · ${date}`;
}
