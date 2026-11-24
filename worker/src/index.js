import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

// Shadow News: an always-on MCP server (Cloudflare Worker) that Gemini calls once a day
// with the top 10 stories. It adds images and posts them to the Discord news channel.
//
// Login: OAuth with a one-time passcode page (Gemini only connects to servers with a login).
// Codes and tokens are HMAC-signed, so no database is needed.
//
// Secrets (wrangler secret put): DISCORD_TOKEN, PASSCODE, SIGNING_KEY
// Vars (wrangler.toml): NEWS_CHANNEL_ID

const CATEGORY_COLORS = { ai: 0x7f77dd, tech: 0x3498db, security: 0x2ecc71, creators: 0xe67e22, other: 0x95a5a6 };
const CATEGORY_LABELS = { ai: '🤖 AI', tech: '💻 Tech', security: '🛡️ Security', creators: '🎬 Creators', other: '📰 News' };

// ---------- signed tokens ----------
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function sign(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env, body)}`;
}

async function verify(env, token, type) {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig || sig !== (await hmac(env, body))) return null;
  const payload = JSON.parse(fromB64u(body));
  if (payload.typ !== type || payload.exp < Date.now() / 1000) return null;
  return payload;
}

async function sha256b64u(s) {
  return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

// ---------- helpers ----------
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers } });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- OAuth ----------
function metadata(base) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
  };
}

function passcodePage(params, error) {
  const hidden = [...params].map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Shadow News</title>
<body style="font-family:system-ui;background:#0f0e17;color:#eee;display:grid;place-items:center;min-height:90vh">
<form method="post" style="background:#1b1a2e;padding:28px;border-radius:12px;max-width:340px">
<h2 style="margin-top:0">🌙 Shadow News</h2><p>Enter the passcode to let Gemini post news to Shadow Garden.</p>
${error ? '<p style="color:#ff7b7b">Wrong passcode.</p>' : ''}${hidden}
<input name="passcode" type="password" autofocus style="width:100%;padding:10px;border-radius:8px;border:0;margin-bottom:12px">
<button style="width:100%;padding:10px;border:0;border-radius:8px;background:#7f77dd;color:#fff;font-weight:600">Allow</button>
</form></body>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

async function authorize(request, env, url) {
  if (request.method === 'GET') return passcodePage(url.searchParams);
  const form = await request.formData();
  const params = new URLSearchParams([...form].filter(([k]) => k !== 'passcode'));
  if (form.get('passcode') !== env.PASSCODE) return passcodePage(params, true);

  const redirect = new URL(params.get('redirect_uri'));
  const code = await sign(env, { typ: 'code', ch: params.get('code_challenge'), exp: Date.now() / 1000 + 300 });
  redirect.searchParams.set('code', code);
  if (params.get('state')) redirect.searchParams.set('state', params.get('state'));
  return Response.redirect(redirect.toString(), 302);
}

async function issueTokens(env) {
  const now = Date.now() / 1000;
  return json({
    access_token: await sign(env, { typ: 'access', exp: now + 7 * 86400 }),
    token_type: 'Bearer',
    expires_in: 7 * 86400,
    refresh_token: await sign(env, { typ: 'refresh', exp: now + 365 * 86400 }),
  });
}

async function token(request, env) {
  const raw = await request.text();
  const p = request.headers.get('content-type')?.includes('json') ? new URLSearchParams(JSON.parse(raw)) : new URLSearchParams(raw);
  if (p.get('grant_type') === 'authorization_code') {
    const code = await verify(env, p.get('code'), 'code');
    if (!code || (code.ch && code.ch !== (await sha256b64u(p.get('code_verifier') ?? '')))) return json({ error: 'invalid_grant' }, 400);
    return issueTokens(env);
  }
  if (p.get('grant_type') === 'refresh_token') {
    if (!(await verify(env, p.get('refresh_token'), 'refresh'))) return json({ error: 'invalid_grant' }, 400);
    return issueTokens(env);
  }
  return json({ error: 'unsupported_grant_type' }, 400);
}

// ---------- Discord ----------
async function discord(env, path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      method: 'POST',
      headers: { authorization: `Bot ${env.DISCORD_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
      return res.json();
    }
    await sleep(((await res.json()).retry_after ?? 1) * 1000 + 100);
  }
  throw new Error('Discord rate limit');
}

/** The article's own preview image (og:image). */
async function pageImage(link) {
  try {
    const res = await fetch(link, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ShadowNews/1.0)' }, signal: AbortSignal.timeout(8000) });
    const html = (await res.text()).slice(0, 300_000);
    for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
      if (/(property|name)=["'](og:image|twitter:image)["']/i.test(tag)) {
        const src = tag.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
        if (src && /^https?:\/\//.test(src)) return src;
      }
    }
  } catch {
    // Blocked or slow page: post without an image.
  }
  return null;
}

function editionHeader(title) {
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return `## 🗞️ ${title || "Today's Top 10"} · ${date}\n-# Picked by Gemini from today's news`;
}

async function postNews(env, { stories, edition_title }) {
  const images = await Promise.all(stories.map((s) => (s.image_url ? s.image_url : pageImage(s.url))));
  await discord(env, `/channels/${env.NEWS_CHANNEL_ID}/messages`, { content: editionHeader(edition_title), allowed_mentions: { parse: [] } });
  let posted = 0;
  for (const [i, s] of stories.entries()) {
    const cat = CATEGORY_COLORS[s.category] ? s.category : 'other';
    const lines = [s.summary, s.why_it_matters && `**Why it matters:** ${s.why_it_matters}`].filter(Boolean);
    const embed = {
      color: CATEGORY_COLORS[cat],
      author: { name: `#${i + 1} · ${CATEGORY_LABELS[cat]}${s.source ? ` · ${s.source}` : ''}`.slice(0, 256) },
      title: s.title.slice(0, 256),
      url: s.url,
      description: lines.join('\n\n').slice(0, 1000),
    };
    if (images[i]) embed.image = { url: images[i] };
    await discord(env, `/channels/${env.NEWS_CHANNEL_ID}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } });
    posted++;
  }
  return posted;
}

// ---------- MCP ----------
// Uses the official MCP SDK: Gemini only completed tool calls against the SDK's responses,
// not against a hand-rolled JSON-RPC handler. Inputs stay flat strings for the same reason.
function buildServer(env) {
  const server = new McpServer({ name: 'shadow-news', version: '1.0.0' });
  server.registerTool(
    'post_news',
    {
      title: 'Post the daily news to Shadow Garden',
      description:
        "Posts today's top news stories to the Shadow Garden Discord news channel, one message per story with its image. " +
        'Call it once per day with up to 10 stories, most important first.',
      inputSchema: {
        stories_json: z
          .string()
          .describe(
            'JSON array of up to 10 stories, most important first. Each story: ' +
              '{"title": "...", "url": "https://...", "summary": "1-2 sentences", "why_it_matters": "one line", ' +
              '"category": "ai|tech|security|creators|other", "source": "publisher name"}',
          ),
        edition_title: z.string().optional().describe("Optional header title, default \"Today's Top 10\""),
      },
    },
    async ({ stories_json, edition_title }) => {
      console.log('post_news called', stories_json.slice(0, 200));
      const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
      let list;
      try {
        list = JSON.parse(stories_json);
      } catch {
        return fail('stories_json is not valid JSON. Send a JSON array of story objects.');
      }
      const stories = (Array.isArray(list) ? list : []).filter((s) => s?.title && /^https?:\/\//.test(s?.url ?? '')).slice(0, 10);
      if (!stories.length) return fail('No valid stories (each needs a title and an http(s) url).');
      try {
        const n = await postNews(env, { edition_title, stories });
        console.log(`posted ${n} stories`);
        return { content: [{ type: 'text', text: `Posted ${n} stories to Shadow Garden.` }] };
      } catch (err) {
        console.error(err);
        return fail(`Posting failed: ${err.message}`);
      }
    },
  );
  return server;
}

async function mcp(request, env) {
  const body = await request.clone().text();
  console.log('mcp in:', body.slice(0, 400));
  // Stateless: a fresh server and transport per request, so there's no session to lose.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildServer(env);
  await server.connect(transport);
  return transport.handleRequest(request);
}

// ---------- router ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const base = url.origin;
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    if (path.startsWith('/.well-known/oauth-protected-resource')) {
      return json({ resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ['header'] });
    }
    if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/openid-configuration') return json(metadata(base));
    if (path === '/register' && request.method === 'POST') {
      const meta = await request.json().catch(() => ({}));
      return json({ ...meta, client_id: crypto.randomUUID(), client_id_issued_at: Math.floor(Date.now() / 1000), token_endpoint_auth_method: 'none' }, 201);
    }
    if (path === '/authorize') return authorize(request, env, url);
    if (path === '/token' && request.method === 'POST') return token(request, env);

    if (path === '/mcp') {
      const auth = request.headers.get('authorization')?.replace(/^Bearer /i, '');
      if (!(await verify(env, auth, 'access'))) {
        return json({ error: 'unauthorized' }, 401, { 'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"` });
      }
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
      return mcp(request, env);
    }

    if (path === '/') return new Response('Shadow News is running. 🌙');
    return new Response('Not found', { status: 404 });
  },
};
