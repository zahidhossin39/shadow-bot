// Step 0 proof test: a tiny MCP server Gemini can call. One harmless tool that logs every call.
// Gemini only connects to servers with an OAuth login, so this includes a minimal auto-approving one.
// Run: node scripts/mcp-test.js
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const PORT = 3939;
const codes = new Map(); // auth code -> { challenge, redirect }
const tokens = new Set(); // valid access + refresh tokens (memory only: a test)
const rand = () => randomBytes(24).toString('base64url');

function buildServer() {
  const server = new McpServer({ name: 'shadow-bot-test', version: '0.0.1' });
  server.registerTool(
    'post_test_message',
    {
      title: 'Post a test message to Shadow Garden',
      description: 'Posts a short test message to the Shadow Garden Discord server. Use it when asked to send a test or hello to Shadow Bot / Discord.',
      inputSchema: { text: z.string().max(300).describe('The message to post') },
    },
    async ({ text }) => {
      console.log(`[mcp-test] ${new Date().toISOString()} TOOL CALLED post_test_message: ${text}`);
      return { content: [{ type: 'text', text: 'Posted to Shadow Garden.' }] };
    },
  );
  return server;
}

const json = (res, status, body, headers = {}) =>
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers }).end(JSON.stringify(body));

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

createServer(async (req, res) => {
  const base = `https://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
  const url = new URL(req.url, base);
  console.log(`[mcp-test] ${req.method} ${url.pathname}`);

  if (req.method === 'OPTIONS') {
    return res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }).end();
  }

  if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
    return json(res, 200, { resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ['header'] });
  }
  if (url.pathname === '/.well-known/oauth-authorization-server' || url.pathname === '/.well-known/openid-configuration') {
    return json(res, 200, {
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    });
  }
  if (url.pathname === '/register' && req.method === 'POST') {
    const meta = JSON.parse((await readBody(req)) || '{}');
    return json(res, 201, { ...meta, client_id: rand(), client_id_issued_at: Math.floor(Date.now() / 1000), token_endpoint_auth_method: 'none' });
  }
  if (url.pathname === '/authorize') {
    // Auto-approve: fine for a throwaway test. The real server will ask for a passcode here.
    const redirect = url.searchParams.get('redirect_uri');
    const code = rand();
    codes.set(code, { challenge: url.searchParams.get('code_challenge') });
    const back = new URL(redirect);
    back.searchParams.set('code', code);
    if (url.searchParams.get('state')) back.searchParams.set('state', url.searchParams.get('state'));
    console.log('[mcp-test] authorized, redirecting back to', back.origin);
    return res.writeHead(302, { location: back.toString() }).end();
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    const raw = await readBody(req);
    const p = req.headers['content-type']?.includes('json') ? new URLSearchParams(JSON.parse(raw)) : new URLSearchParams(raw);
    if (p.get('grant_type') === 'authorization_code') {
      const entry = codes.get(p.get('code'));
      codes.delete(p.get('code'));
      const verifier = p.get('code_verifier');
      const ok = entry && (!entry.challenge || createHash('sha256').update(verifier ?? '').digest('base64url') === entry.challenge);
      if (!ok) return json(res, 400, { error: 'invalid_grant' });
    } else if (p.get('grant_type') === 'refresh_token') {
      if (!tokens.has(p.get('refresh_token'))) return json(res, 400, { error: 'invalid_grant' });
    } else return json(res, 400, { error: 'unsupported_grant_type' });
    const access = rand();
    const refresh = rand();
    tokens.add(access).add(refresh);
    console.log('[mcp-test] issued token');
    return json(res, 200, { access_token: access, token_type: 'Bearer', expires_in: 86400, refresh_token: refresh });
  }

  if (url.pathname === '/mcp') {
    const token = req.headers.authorization?.replace(/^Bearer /i, '');
    if (!tokens.has(token)) {
      return json(res, 401, { error: 'unauthorized' }, { 'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"` });
    }
    if (req.method !== 'POST') return res.writeHead(405, { allow: 'POST' }).end();
    const raw = await readBody(req);
    // Stateless: a fresh server per request, so there's no session to lose.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = buildServer();
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    return transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined);
  }

  res.writeHead(404).end();
}).listen(PORT, () => console.log(`[mcp-test] listening on http://localhost:${PORT}/mcp`));
