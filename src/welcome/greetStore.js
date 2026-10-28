// Who has clicked "Welcome them" on which welcome message, saved to disk so a restart
// doesn't reset counts or let people greet twice.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../../data/', import.meta.url);
const FILE = new URL('greets.json', DIR);
const MAX_MESSAGES = 500; // keep the file small: only the most recent welcomes matter

let store = {};
try {
  store = JSON.parse(readFileSync(FILE, 'utf8'));
} catch {
  store = {};
}

function save() {
  const keys = Object.keys(store);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_MESSAGES))) delete store[k];
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store));
}

/** Record a greet. Returns { added, count }; added is false if this user already greeted. */
export function addGreet(messageId, userId) {
  const users = (store[messageId] ??= []);
  if (users.includes(userId)) return { added: false, count: users.length };
  users.push(userId);
  save();
  return { added: true, count: users.length };
}
