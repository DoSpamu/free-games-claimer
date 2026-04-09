# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) (itself a fork of vogler/free-games-claimer). The upstream repo contains the actual game-claiming scripts (`epic-games.js`, `gog.js`, `prime-gaming.js`, `steam-games.js`, `aliexpress.js`). This fork adds:

- **`run.js`** — one-shot runner: sends Discord notifications for startup / nothing-to-claim / error+screenshot, then exits
- **`src/discord.js`** — Discord webhook notification module
- **`src/logger.js`** — structured logger with timestamps and levels
- **`src/util.js`** — override of upstream's util: `notify(html)` also fires Discord alongside Apprise

The upstream scripts are **not present** in this repo — only the overlay files are tracked here. The image is built on top of `ghcr.io/p-adamiec/free-games-claimer:enhanced`.

## Commands

```bash
# Build and start (Portainer / local)
docker compose up -d --build

# Follow logs
docker compose logs -f

# Run manually (single platform)
docker exec fgc node epic-games.js

# Run all platforms via runner
docker exec fgc node run.js prime-gaming gog epic-games aliexpress
```

## Architecture

### Execution flow

```
docker-entrypoint.sh  (upstream: sets DISPLAY, starts TurboVNC + noVNC on :6080)
  └─ bash -c "node run.js prime-gaming gog epic-games aliexpress; sleep 1d"
       │
       ├─ notifyOnline()              → Discord: 🟢 container started
       │
       ├─ for each platform script:
       │    ├─ countClaimed(db) before
       │    ├─ spawn("node", ["<script>.js"])
       │    │    └─ upstream script → notify(html) → Apprise + Discord ✅ (if games claimed)
       │    ├─ countClaimed(db) after
       │    ├─ if exit code != 0  → notifyErrorWithScreenshot() → Discord ❌ + PNG
       │    └─ if no new games   → notifyEmpty()               → Discord ℹ️
       │
       └─ process.exit(0)   →   sleep 1d   →   Docker restarts container next day
```

`restart: unless-stopped` + `sleep 1d` handles daily scheduling — no cron daemon needed.

### Notification pipeline

`src/util.js` — `notify(html)` (unchanged Apprise behavior + Discord side-effect):
- Called by upstream scripts when games are claimed
- Also fires `notifyFromHtml(title, html)` from `src/discord.js` when `DISCORD_WEBHOOK` is set
- Fire-and-forget — Discord errors never crash the claimer

`run.js` — handles the notifications that upstream scripts don't send:
- `notifyOnline` — on every container start
- `notifyEmpty` — when a script exits 0 but DB has no new entries
- `notifyErrorWithScreenshot` — when a script exits non-zero; attaches latest PNG from `data/screenshots/`

`src/discord.js` exports:
- `notifyFromHtml(title, html)` — called by util.notify()
- `notifyOnline(platforms)` — called by run.js on start
- `notifyEmpty(platforms)` — called by run.js when nothing claimed
- `notifyErrorWithScreenshot(platform, error, path)` — called by run.js on error
- `notifySuccess`, `notifyError`, `notifyJobSummary`, `notifyWeeklyDigest`, `notifyUpstreamUpdate` — available but not currently used

### Key env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `DISCORD_WEBHOOK` | — | Discord webhook URL |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARN`/`ERROR` |
| `SHOW` | `1` | Show browser in VNC |
| `VNC_PASSWORD` | — | Password for noVNC on :6080 |

Credentials (`EG_EMAIL`, `PG_EMAIL`, etc.) are optional — manual VNC login persists in the `fgc_data` volume.

### Database

Upstream scripts use `lowdb` JSON files in `/fgc/data/` (volume `fgc_data`):
`epic-games.json`, `gog.json`, `prime-gaming.json`, `steam.json`

`run.js` reads these to detect whether a platform claimed any new games (counts entries with `status: "claimed"` before vs after each script run).

## GitHub

Repo: **https://github.com/DoSpamu/free-games-claimer**

Push changes after every modification:
```bash
git add <files>
git commit -m "description"
git push
```
