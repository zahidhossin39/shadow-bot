import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Cinzel.ttf'), 'Cinzel');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter.ttf'), 'Inter');

const W = 1024;
const H = 450;

const C = {
  bg: '#0a0a0f',
  border: '#26215C',
  disk: '#1c1840',
  moon: '#CECBF6',
  ring: '#7F77DD',
  glow: '#534AB7',
  avatarBg: '#26215C',
  kicker: '#7F77DD',
  title: '#EEEDFE',
  name: '#f2f3f5',
  meta: '#888780',
};

const AVATAR = { x: 230, y: H / 2, r: 120 };
const TEXT_X = 420;
const TEXT_MAX = W - TEXT_X - 56;

// Fetch ourselves so a dead URL falls back to an initial instead of throwing.
async function loadAvatar(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

// Shrink the font until the text fits, then truncate with an ellipsis as a last resort.
function fitText(ctx, text, { family, size, minSize, maxWidth, weight = '' }) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`.trim();
  while (ctx.measureText(text).width > maxWidth && s > minSize) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`.trim();
  }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBackground(ctx) {
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.save();
  ctx.clip();

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Soft purple haze behind the avatar.
  const haze = ctx.createRadialGradient(AVATAR.x, AVATAR.y, 40, AVATAR.x, AVATAR.y, 420);
  haze.addColorStop(0, 'rgba(83, 74, 183, 0.28)');
  haze.addColorStop(1, 'rgba(83, 74, 183, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  // Big dark disk peeking from the top-right corner.
  ctx.fillStyle = C.disk;
  ctx.beginPath();
  ctx.arc(W - 30, 20, 210, 0, Math.PI * 2);
  ctx.fill();

  // Vignette darkens the edges.
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();

  ctx.strokeStyle = C.border;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 27);
  ctx.stroke();
}

// Crescent: draw a full moon on its own canvas, then erase a circle out of it
// (destination-out) so the background shows through the bite.
function drawMoon(ctx, faded) {
  const r = 50;
  const pad = 60;
  const size = (r + pad) * 2;
  const c = createCanvas(size, size);
  const m = c.getContext('2d');
  const cx = size / 2;

  m.fillStyle = C.moon;
  m.beginPath();
  m.arc(cx, cx, r, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(cx - 28, cx + 16, r, 0, Math.PI * 2);
  m.fill();

  ctx.save();
  ctx.globalAlpha = faded ? 0.35 : 1;
  ctx.shadowColor = C.moon;
  ctx.shadowBlur = 30;
  ctx.drawImage(c, W - 120 - cx, 92 - cx);
  ctx.restore();
}

function drawAvatar(ctx, img, username, faded) {
  const { x, y, r } = AVATAR;

  // Glowing ring drawn first so the avatar sits on top of the glow.
  ctx.save();
  ctx.shadowColor = C.glow;
  ctx.shadowBlur = faded ? 10 : 50;
  ctx.strokeStyle = faded ? '#4a4766' : C.ring;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (faded) {
    ctx.filter = 'grayscale(1)';
    ctx.globalAlpha = 0.45;
  }
  if (img) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = C.avatarBg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = C.moon;
    ctx.font = '96px Cinzel';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username[0] || '?').toUpperCase(), x, y + 6);
  }
  ctx.restore();
}

function drawText(ctx, { username, memberNumber, date, faded }) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = faded ? 0.6 : 1;

  ctx.fillStyle = C.kicker;
  ctx.font = '22px Inter';
  ctx.letterSpacing = '8px';
  ctx.fillText(faded ? 'FADED FROM' : 'WELCOME TO', TEXT_X, 150);

  ctx.fillStyle = C.title;
  ctx.letterSpacing = '3px';
  const title = fitText(ctx, 'SHADOW GARDEN', { family: 'Cinzel', size: 62, minSize: 40, maxWidth: TEXT_MAX });
  ctx.fillText(title, TEXT_X, 222);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = C.glow;
  ctx.fillRect(TEXT_X, 250, 220, 3);

  ctx.fillStyle = C.name;
  const name = fitText(ctx, username, { family: 'Inter', size: 40, minSize: 26, maxWidth: TEXT_MAX });
  ctx.fillText(name, TEXT_X, 312);

  ctx.fillStyle = C.meta;
  ctx.font = '24px Inter';
  const status = faded ? 'Faded into the shadows' : `Shadow #${memberNumber}`;
  ctx.fillText(`${status} · ${date}`, TEXT_X, 356);

  ctx.globalAlpha = 1;
}

/**
 * Render a welcome (or goodbye, with faded: true) card as a PNG buffer.
 * Pure: data in, image out, no Discord objects.
 */
export async function renderWelcomeCard({ avatarURL, username, memberNumber, joinedAt = new Date(), faded = false }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const avatar = await loadAvatar(avatarURL);
  const date = joinedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  drawBackground(ctx);
  drawMoon(ctx, faded);
  drawAvatar(ctx, avatar, username, faded);
  drawText(ctx, { username, memberNumber, date, faded });

  return canvas.encode('png');
}
