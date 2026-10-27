// Render sample cards to preview/ so the design can be checked without Discord.
import { writeFile, mkdir } from 'node:fs/promises';
import { renderWelcomeCard } from '../src/card/welcomeCard.js';

const OUT = new URL('../preview/', import.meta.url);
await mkdir(OUT, { recursive: true });

const samples = {
  welcome: { avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', username: 'Rainz', memberNumber: 128 },
  'long-name': { avatarURL: 'https://cdn.discordapp.com/embed/avatars/3.png', username: 'xX_TheShadowOfTheEminenceInDarkness_Xx', memberNumber: 1042 },
  'no-avatar': { avatarURL: 'https://invalid.example/404.png', username: 'cid', memberNumber: 7 },
  goodbye: { avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', username: 'Rainz', memberNumber: 128, faded: true },
};

for (const [name, data] of Object.entries(samples)) {
  const png = await renderWelcomeCard(data);
  await writeFile(new URL(`${name}.png`, OUT), png);
  console.log(`preview/${name}.png  ${png.length} bytes`);
}
