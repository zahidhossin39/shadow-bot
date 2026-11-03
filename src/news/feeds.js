// Reads RSS/Atom feeds and turns each article into { title, link, summary, image, date, source }.
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: { item: [['media:content', 'media', { keepArray: true }], ['media:thumbnail', 'thumb']] },
});
const UA = 'Mozilla/5.0 (compatible; ShadowBot/1.0; +https://github.com/zahidhossin39/shadow-bot)';

// Our own fetch with a timeout: one slow site must never stall a whole edition.
async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");

// Feeds that carry an image put it in one of these places.
function feedImage(item) {
  const url =
    item.enclosure?.url ??
    item.media?.find((m) => m.$?.url)?.$.url ??
    item.thumb?.$?.url ??
    (item['content:encoded'] ?? item.content ?? '').match(/<img[^>]+src="([^"]+)"/)?.[1];
  return url && /^https?:\/\//.test(url) ? decode(url) : null;
}

/** Short summary: first sentences up to ~220 chars, minus WordPress "The post … appeared first on …" junk. */
export function cleanSummary(text = '', max = 220) {
  const s = text
    .replace(/The post .* appeared first on .*$/s, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\[(\.\.\.|…)\]$/, '…')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sentenceEnd = cut.lastIndexOf('. ');
  return sentenceEnd > max * 0.5 ? cut.slice(0, sentenceEnd + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

export async function fetchFeed(feed) {
  const parsed = await parser.parseString(await get(feed.url));
  return parsed.items
    .filter((it) => it.title && it.link)
    .map((it) => ({
      title: it.title.trim(),
      link: it.link,
      summary: cleanSummary(it.contentSnippet ?? it.summary),
      image: feedImage(it),
      date: it.isoDate ? new Date(it.isoDate) : null,
      source: feed.name,
    }));
}

/** The article's own preview image (og:image), the one link previews use. Null if the page won't give one. */
export async function pageImage(url) {
  try {
    const html = (await get(url)).slice(0, 300_000);
    for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
      if (/(property|name)=["'](og:image|twitter:image)["']/i.test(tag)) {
        const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
        if (content && /^https?:\/\//.test(content)) return decode(content);
      }
    }
  } catch {
    // Blocked or slow page: fall back to the feed's image.
  }
  return null;
}
