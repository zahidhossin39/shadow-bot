// Render sample cards to preview/ so the design can be checked without Discord.
import { writeFile, mkdir } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderWelcomeCard } from '../src/card/welcomeCard.js';
import { renderWelcomeCardV2 } from '../src/card/welcomeCardV2.js';

const OUT = new URL('../preview/', import.meta.url);
await mkdir(OUT, { recursive: true });

const samples = {
  welcome: { avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', username: 'Rainz', memberNumber: 128 },
  'long-name': { avatarURL: 'https://cdn.discordapp.com/embed/avatars/3.png', username: 'xX_TheShadowOfTheEminenceInDarkness_Xx', memberNumber: 1042 },
  'no-avatar': { avatarURL: 'https://invalid.example/404.png', username: 'cid', memberNumber: 7 },
  goodbye: { avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', username: 'Rainz', memberNumber: 128, faded: true },
};

for (const [name, data] of Object.entries(samples)) {
  const v1 = await renderWelcomeCard(data);
  const v2 = await renderWelcomeCardV2(data);
  await writeFile(new URL(`${name}.png`, OUT), v1);
  await writeFile(new URL(`v2-${name}.png`, OUT), v2);

  // v1 on top, v2 below, for side-by-side judging.
  const cmp = createCanvas(1024, 450 * 2 + 24);
  const ctx = cmp.getContext('2d');
  ctx.fillStyle = '#313338';
  ctx.fillRect(0, 0, cmp.width, cmp.height);
  ctx.drawImage(await loadImage(v1), 0, 0);
  ctx.drawImage(await loadImage(v2), 0, 474);
  await writeFile(new URL(`compare-${name}.png`, OUT), await cmp.encode('png'));
  console.log(`preview/${name}.png, v2-${name}.png, compare-${name}.png`);
}
