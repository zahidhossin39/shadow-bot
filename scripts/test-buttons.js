// Offline check for the goodbye message and every button handler, using fake Discord objects.
import { Collection } from 'discord.js';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { buildGoodbyeMessage, buildWelcomeMessage } from '../src/welcome/message.js';
import { handleWelcomeInteraction } from '../src/welcome/interactions.js';

await rm(new URL('../data/', import.meta.url), { recursive: true, force: true });

const channels = new Collection([['c-rules', { id: 'c-rules', name: '⚖️・ʀᴜʟᴇs' }]]);
const guild = { name: 'Shadow Garden', memberCount: 128, channels: { cache: channels } };

const avatar = () => 'https://cdn.discordapp.com/embed/avatars/1.png';
const newMember = { id: 'new', displayName: 'Rainz', joinedAt: new Date(), guild, user: { bot: false }, displayAvatarURL: avatar };

// Fake interaction that records every reply/update.
function click({ customId, userId }) {
  const calls = [];
  return {
    calls,
    customId,
    guild,
    user: { id: userId },
    message: { id: 'msg-1' },
    isButton: () => true,
    reply: async (p) => calls.push(['reply', p]),
    update: async (p) => calls.push(['update', p]),
    followUp: async (p) => calls.push(['followUp', p]),
  };
}

// 1. Welcome message has the 3 buttons, counter at 0.
const welcome = await buildWelcomeMessage(newMember);
const buttons = welcome.components[0].toJSON().components;
assert.deepEqual(buttons.map((b) => b.custom_id), ['greet:new', 'rules:show']);
assert.equal(buttons[0].label, 'Welcome them (0)');
console.log('✓ welcome message has Welcome them (0) / Rules');

// 2. Goodbye works from a partial member (only .user, no displayName).
const partial = {
  guild,
  user: { bot: false, username: 'rainz', globalName: 'Rainz', displayAvatarURL: avatar },
};
const bye = await buildGoodbyeMessage(partial);
assert.equal(bye.embeds[0].toJSON().title, 'Rainz faded into the shadows');
assert.equal(bye.files[0].name, 'goodbye.png');
await mkdir(new URL('../preview/', import.meta.url), { recursive: true });
await writeFile(new URL('../preview/goodbye-message.png', import.meta.url), bye.files[0].attachment);
console.log('✓ goodbye message renders for a partial member');

// 3. Greeting: self is refused, first click counts, repeat click doesn't.
let i = click({ customId: 'greet:new', userId: 'new' });
await handleWelcomeInteraction(i);
assert.match(i.calls[0][1].content, /can't welcome yourself/);

i = click({ customId: 'greet:new', userId: 'alice' });
await handleWelcomeInteraction(i);
assert.equal(i.calls[0][0], 'update');
assert.equal(i.calls[0][1].components[0].toJSON().components[0].label, 'Welcome them (1)');

i = click({ customId: 'greet:new', userId: 'bob' });
await handleWelcomeInteraction(i);
assert.equal(i.calls[0][1].components[0].toJSON().components[0].label, 'Welcome them (2)');

i = click({ customId: 'greet:new', userId: 'alice' });
await handleWelcomeInteraction(i);
assert.match(i.calls[0][1].content, /already welcomed/);
console.log('✓ greet counter: self blocked, 0 → 1 → 2, double-click blocked');

// 4. Rules reply is private and links the styled #rules channel.
i = click({ customId: 'rules:show', userId: 'alice' });
await handleWelcomeInteraction(i);
assert.ok(i.calls[0][1].flags);
assert.match(i.calls[0][1].embeds[0].toJSON().description, /<#c-rules>/);
console.log('✓ rules: private reply with link to #rules');

await rm(new URL('../data/', import.meta.url), { recursive: true, force: true });
console.log('\nAll checks passed.');
