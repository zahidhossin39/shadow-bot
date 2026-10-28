# Shadow Bot

## Git
- Co-author line: leave `Co-Authored-By: Claude` OUT of commits (decided 2026-10-28).
- GitHub repo is public (made public 2026-10-29 so Enzonic can clone it without a token). Never commit .env or tokens.
- Hosted on Enzonic (free Discord.js Bot server), cloned from branch master. Startup file is `src/index.js`.

## Deploying
- Push to master, then click **Restart** on Enzonic. `src/index.js` runs `git pull` (and `npm install` if deps changed) before loading `src/bot.js`. No Reinstall needed.
- The console shows `[update] ...` (what was pulled) and `[version] <commit>` (what is running).
- The pull only runs on the host (it sets `SERVER_UUID`); `npm start` on a PC never pulls.
- The token lives in `.env` on the server (gitignored). Avoid Reinstall: it may wipe files.
