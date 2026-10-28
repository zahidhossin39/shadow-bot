// Offline check: build the full welcome message from a fake member, no Discord login needed.
import { Collection } from 'discord.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildWelcomeMessage } from '../src/welcome/message.js';

const channels = new Collection([
  ['111', { id: '111', name: 'welcome-to-shadow-graden' }],
  ['222', { id: '222', name: 'rules' }],
  ['333', { id: '333', name: 'guides-tutorials' }],
]);

const member = {
  id: '999',
  displayName: 'Rainz',
  joinedAt: new Date(),
  user: { bot: false, tag: 'rainz' },
  guild: { name: 'Shadow Garden', memberCount: 128, channels: { cache: channels } },
  displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png',
};

const msg = await buildWelcomeMessage(member);
console.log('content:', msg.content);
console.log('embed:', JSON.stringify(msg.embeds[0].toJSON(), null, 2));
console.log('file:', msg.files[0].name);
await mkdir(new URL('../preview/', import.meta.url), { recursive: true });
await writeFile(new URL('../preview/message-card.png', import.meta.url), msg.files[0].attachment);
