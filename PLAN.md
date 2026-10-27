# Shadow Bot — Plan

Custom Discord bot for the **Shadow Garden** server. First job: replace Discord's plain built-in join messages with a themed welcome.

## Concept
Joining the server = being initiated into a secret order. Each member "steps out of the light" and becomes a numbered shadow.
Visual style: near-black background, purple accents (#7F77DD / #534AB7 / #26215C), crescent moon, serif title, avatar in a purple ring.

**Visual reference:** open `welcome-mockup.html` in a browser — match it.

## v1 — build this first
On `guildMemberAdd`, post in the welcome channel:

1. **Welcome card image** (1024×450, drawn per member)
   - Avatar in a purple ring (left)
   - "WELCOME TO" (small, spaced) / "SHADOW GARDEN" (big serif)
   - Username, "Shadow #N · <join date>"
   - Crescent moon top-right, dark background
2. **Embed** (purple side bar)
   - Message text: `@user has stepped out of the light.`
   - Header: `SHADOW GARDEN · MEMBER #N`
   - Title: "A new shadow has awakened"
   - Short lore line + 3 steps: #rules → #guides-tutorials → #chat-room
   - Footer: "Hide in the shadows, rise in the garden"
3. **Buttons**
   - **Welcome them (N)** — members click to greet; counter goes up
   - **Pick roles** — private (ephemeral) select menu for interest roles (AI, Design, Memes…)
   - **Rules** — shows rules privately
4. **Auto-role**: give new members "Shadow Recruit"
5. **Goodbye card** on `guildMemberRemove`: faded card, "<name> faded into the shadows"
6. **`/welcome-test`** (admin only): previews the card on yourself

## v2 — later ideas
- Milestone cards (member #100, #250…) in gold + black
- Activity ranks: Recruit → Agent → Elite → Seven Shadows
- Optional DM welcome with server guide

## Tech
- Node.js + **discord.js v14**
- **@napi-rs/canvas** for the card (prebuilt on Windows, no native build pain)
- **dotenv** for the token
- `config.json` for channel IDs, role IDs, colors, text — tweak look without touching code

Suggested layout:
```
Shadow-Bot/
  src/index.js            # client + event wiring
  src/events/memberAdd.js
  src/events/memberRemove.js
  src/card/welcomeCard.js # canvas drawing
  src/commands/welcomeTest.js
  config.json
  .env                    # DISCORD_TOKEN=... (user fills in, gitignored)
```

## Setup the user must do
- Developer Portal → Bot → enable **Server Members Intent** (required for join events)
- Paste bot token into `.env` themselves
- Server Settings → Engagement → System Messages → turn off default join message
- Provide IDs: welcome channel, #rules, #guides-tutorials, #chat-room, "Shadow Recruit" role

## Server context
- Server: Shadow Garden. Bot app already added: "Shadow Bot".
- Welcome channel: `welcome-to-shadow-graden` (note the typo in the channel name; fix optional).
- Other channels: tools, guides-tutorials, design-assets, ai-tools, news-updates, ideas-requests, chat-room, memes, gallery.
- User is on Windows, uses `npm`. Verify the bot actually runs before calling a step done.
