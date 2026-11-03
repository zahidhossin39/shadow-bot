// Remembers which articles were already posted and which edition ran last, in data/news.json,
// so restarts never repost a story or run the same edition twice.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../../data/', import.meta.url);
const FILE = new URL('news.json', DIR);
const MAX_LINKS = 1000;

function load() {
  try {
    return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  } catch {
    return {};
  }
}

function save(state) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function isPosted(link) {
  return (load().posted ?? []).includes(link);
}

export function markPosted(links) {
  const state = load();
  state.posted = [...(state.posted ?? []), ...links].slice(-MAX_LINKS);
  save(state);
}

export function lastSlot() {
  return load().lastSlot ?? null;
}

export function setLastSlot(slot) {
  save({ ...load(), lastSlot: slot });
}
