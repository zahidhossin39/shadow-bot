// Offline check for the news feature: schedule math, then a real fetch of every feed (nothing is posted).
import assert from 'node:assert/strict';
import { cleanSummary } from '../src/news/feeds.js';
import { collectStories, editionHeader, storyEmbed } from '../src/news/edition.js';
import { currentSlot } from '../src/news/scheduler.js';

// 1. Slots, in Dhaka time (UTC+6).
assert.equal(currentSlot(new Date('2026-11-04T03:00:00Z')), '2026-11-04 09:00'); // 09:00 Dhaka
assert.equal(currentSlot(new Date('2026-11-04T08:59:00Z')), '2026-11-04 09:00'); // 14:59
assert.equal(currentSlot(new Date('2026-11-04T09:00:00Z')), '2026-11-04 15:00'); // 15:00
assert.equal(currentSlot(new Date('2026-11-04T17:30:00Z')), '2026-11-04 21:00'); // 23:30
assert.equal(currentSlot(new Date('2026-11-04T20:00:00Z')), '2026-11-04 21:00'); // 02:00 next day
assert.equal(currentSlot(new Date('2026-11-05T01:00:00Z')), '2026-11-04 21:00'); // 07:00, before the first slot
console.log('✓ schedule: 09:00 / 15:00 / 21:00 Dhaka, early morning maps to last night');

assert.match(editionHeader(new Date('2026-11-04T03:00:00Z')), /Morning edition · Wednesday 4 November/);
assert.match(editionHeader(new Date('2026-11-04T15:00:00Z')), /Evening edition/);
console.log('✓ edition header:', editionHeader());

// 2. Summaries.
assert.equal(cleanSummary('Short one.\nThe post X appeared first on Y.'), 'Short one.');
assert.ok(cleanSummary('word '.repeat(100)).length <= 221);
console.log('✓ summaries trimmed');

// 3. Real feeds.
const t = Date.now();
const stories = await collectStories();
console.log(`\nFetched ${stories.length} stories in ${((Date.now() - t) / 1000).toFixed(1)}s:\n`);
for (const s of stories) {
  const e = storyEmbed(s).toJSON();
  console.log(`${e.author.name}\n  ${e.title}\n  ${e.description}\n  img: ${e.image?.url ?? 'NONE'}\n  ${e.url}\n`);
}
assert.equal(stories.length, 6);
assert.equal(new Set(stories.map((s) => s.link)).size, stories.length);
console.log(`✓ ${stories.filter((s) => s.image).length}/${stories.length} stories have an image`);
console.log('\nAll checks passed.');
