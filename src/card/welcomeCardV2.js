// v2 prototype, "Moonrise": night sky, the moon as a halo behind the member,
// the username as the hero, and a motivational line + member badge.
import { createCanvas } from '@napi-rs/canvas';
import { loadAvatar, fitText, loadMoon } from './welcomeCard.js';

const W = 1024;
const H = 450;

const C = {
  skyTop: '#06050c',
  skyBottom: '#15112b',
  border: '#2c2566',
  moonGlow: '206, 203, 246',
  mist: '83, 74, 183',
  accent: '#7F77DD',
  kicker: '#A9A3EE',
  name: '#F4F3FF',
  tagline: '#C9C5EC',
  meta: '#8E8AB8',
  avatarBg: '#26215C',
};

const MOON = { x: 790, y: 225, r: 172 };
const AVATAR = { x: MOON.x, y: MOON.y, r: 98 };
const TEXT_X = 68;
const TEXT_MAX = MOON.x - MOON.r - TEXT_X - 24;

const moonImage = await loadMoon(MOON.r * 2);

// Seeded RNG so every card gets the same sky.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The sky never changes, so build it once and blit it per card.
function buildSky() {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = rng(42);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(1, C.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars: mostly faint pin-pricks, a few brighter ones with a soft glow. Denser near the top.
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = Math.pow(rand(), 1.6) * H * 0.85;
    const bright = rand() < 0.07;
    const r = bright ? 1.1 + rand() * 0.8 : 0.35 + rand() * 0.6;
    ctx.globalAlpha = bright ? 0.8 + rand() * 0.2 : 0.2 + rand() * 0.5;
    ctx.fillStyle = rand() < 0.25 ? '#D9D4FF' : '#FFFFFF';
    if (bright) {
      ctx.shadowColor = '#CFCBFF';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Low mist: wide, flattened glows hugging the bottom edge.
  for (const [x, y, rx, a] of [[180, 470, 520, 0.22], [640, 490, 560, 0.18], [980, 460, 380, 0.2]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.28);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${C.mist}, ${a})`);
    g.addColorStop(1, `rgba(${C.mist}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Film grain keeps the gradients from looking plastic.
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const skyImage = buildSky();

function drawMoonHalo(ctx, faded) {
  const { x, y, r } = MOON;
  ctx.save();
  ctx.globalAlpha = faded ? 0.35 : 1;

  // Wide bloom so the moon lights the sky around it.
  const bloom = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.3);
  bloom.addColorStop(0, `rgba(${C.moonGlow}, 0.32)`);
  bloom.addColorStop(0.4, `rgba(${C.moonGlow}, 0.1)`);
  bloom.addColorStop(1, `rgba(${C.moonGlow}, 0)`);
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = `rgb(${C.moonGlow})`;
  ctx.shadowBlur = 40;
  if (faded) ctx.filter = 'grayscale(1) brightness(0.7)';
  ctx.drawImage(moonImage, x - r, y - r);
  ctx.restore();
}

function drawAvatar(ctx, img, username, faded) {
  const { x, y, r } = AVATAR;

  // Dark drop shadow lifts the avatar off the bright moon.
  ctx.save();
  ctx.shadowColor = 'rgba(4, 3, 12, 0.85)';
  ctx.shadowBlur = 36;
  ctx.fillStyle = '#0b0918';
  ctx.beginPath();
  ctx.arc(x, y, r + 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Thin moonlit ring.
  ctx.save();
  const ring = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  ring.addColorStop(0, faded ? '#6a6780' : '#E6E2FF');
  ring.addColorStop(1, faded ? '#3a3850' : C.accent);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (faded) {
    ctx.filter = 'grayscale(1)';
    ctx.globalAlpha = 0.5;
  }
  if (img) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = C.avatarBg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#E6E2FF';
    ctx.font = '84px Cinzel';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username[0] || '?').toUpperCase(), x, y + 6);
  }
  ctx.restore();
}

// Darken behind the text so it stays readable over stars and mist.
function drawTextScrim(ctx) {
  const g = ctx.createLinearGradient(0, 0, 640, 0);
  g.addColorStop(0, 'rgba(6, 5, 12, 0.7)');
  g.addColorStop(1, 'rgba(6, 5, 12, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Thin rule with a small diamond, like an ornament in an old book.
function drawOrnament(ctx, x, y, faded) {
  ctx.fillStyle = faded ? '#4a4766' : C.accent;
  ctx.fillRect(x, y - 1, 120, 2);
  ctx.save();
  ctx.translate(x + 134, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  ctx.globalAlpha *= 0.4;
  ctx.fillRect(x + 148, y - 1, 60, 2);
}

function drawBadge(ctx, text, x, y, faded) {
  ctx.font = '600 17px Inter';
  ctx.letterSpacing = '3px';
  const w = ctx.measureText(text).width + 36;
  const h = 38;

  ctx.fillStyle = faded ? 'rgba(120, 118, 140, 0.12)' : 'rgba(127, 119, 221, 0.16)';
  ctx.strokeStyle = faded ? '#4a4766' : C.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = C.name;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 18, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
  return w;
}

function drawText(ctx, { username, memberNumber, date, faded }) {
  ctx.textAlign = 'left';
  ctx.globalAlpha = faded ? 0.7 : 1;

  ctx.fillStyle = C.kicker;
  ctx.font = '500 17px Inter';
  ctx.letterSpacing = '6px';
  ctx.fillText(faded ? 'FAREWELL FROM SHADOW GARDEN' : 'WELCOME TO SHADOW GARDEN', TEXT_X, 118);
  ctx.letterSpacing = '0px';

  // The member is the hero: biggest thing on the card, with a soft moonlit glow.
  ctx.save();
  ctx.fillStyle = C.name;
  ctx.shadowColor = `rgba(${C.moonGlow}, 0.45)`;
  ctx.shadowBlur = 18;
  ctx.letterSpacing = '1px';
  const name = fitText(ctx, username, { family: 'Cinzel', weight: '700', size: 62, minSize: 34, maxWidth: TEXT_MAX });
  ctx.fillText(name, TEXT_X, 192);
  ctx.restore();

  drawOrnament(ctx, TEXT_X, 222, faded);

  ctx.globalAlpha = faded ? 0.7 : 1;
  ctx.fillStyle = C.tagline;
  ctx.font = '22px Inter';
  const lines = faded
    ? ['Their shadow fades,', 'but the garden remembers.']
    : ['The shadows have chosen you.', 'Now rise in the garden.'];
  ctx.fillText(lines[0], TEXT_X, 268);
  ctx.fillText(lines[1], TEXT_X, 298);

  const badgeW = drawBadge(ctx, `SHADOW Nº ${memberNumber}`, TEXT_X, 330, faded);

  ctx.fillStyle = C.meta;
  ctx.font = '18px Inter';
  ctx.textBaseline = 'middle';
  ctx.fillText(date, TEXT_X + badgeW + 18, 350);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

function drawFrame(ctx) {
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 27);
  ctx.stroke();
}

export async function renderWelcomeCardV2({ avatarURL, username, memberNumber, joinedAt = new Date(), faded = false }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const avatar = await loadAvatar(avatarURL);
  const date = joinedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 28);
  ctx.clip();

  ctx.save();
  if (faded) ctx.filter = 'grayscale(0.6) brightness(0.8)';
  ctx.drawImage(skyImage, 0, 0);
  ctx.restore();

  drawMoonHalo(ctx, faded);
  drawTextScrim(ctx);
  drawAvatar(ctx, avatar, username, faded);
  drawText(ctx, { username, memberNumber, date, faded });
  drawFrame(ctx);

  return canvas.encode('png');
}
