// Entry point. On the host, pull the latest code from GitHub first, then start the bot,
// so a plain restart is all it takes to deploy. On your PC it just starts the bot.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Panel hosts (Enzonic/Pterodactyl) set SERVER_UUID. AUTO_UPDATE=1 forces it on, 0 forces it off.
const onHost = Boolean(process.env.SERVER_UUID || process.env.P_SERVER_UUID);
const autoUpdate = process.env.AUTO_UPDATE ? process.env.AUTO_UPDATE === '1' : onHost;

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Fingerprint of the dependency files, to tell whether a pull changed them.
function depsHash() {
  const h = createHash('sha256');
  for (const f of ['package.json', 'package-lock.json']) {
    if (existsSync(ROOT + f)) h.update(readFileSync(ROOT + f));
  }
  return h.digest('hex');
}

if (autoUpdate && existsSync(ROOT + '.git')) {
  const before = depsHash();
  try {
    // safe.directory: the host's installer may have created the repo as a different user.
    console.log('[update]', run('git -c safe.directory=* pull --ff-only'));
    if (depsHash() !== before) {
      console.log('[update] dependencies changed, running npm install…');
      run('npm install --omit=dev --no-audit --no-fund');
    }
  } catch (err) {
    // Never block startup on an update problem: run whatever code is already here.
    const lines = (err.stderr || err.message).toString().trim().split('\n');
    console.warn('[update] skipped:', lines.find((l) => /^(fatal|error)/i.test(l)) ?? lines[0]);
  }
}

// Show which commit is running, so a deploy is easy to confirm in the console.
try {
  console.log('[version]', run('git -c safe.directory=* log -1 --format="%h %s"'));
} catch {
  // Not a git checkout (e.g. a Docker build without .git): nothing to show.
}

await import('./bot.js');
