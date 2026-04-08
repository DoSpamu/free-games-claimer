# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) (itself a fork of vogler/free-games-claimer). The upstream repo contains the actual game-claiming scripts (`epic-games.js`, `gog.js`, `prime-gaming.js`, `steam-games.js`). This fork adds:

- **`scheduler.js`** — long-running daemon (node-cron) that replaces the `sleep 1d` loop
- **`src/discord.js`** — Discord webhook notifications
- **`src/logger.js`** — structured logger

The upstream scripts are **not present** in this repo — only the overlay files are tracked here. The full image is built on top of `ghcr.io/p-adamiec/free-games-claimer:enhanced`.

## Commands

```bash
# Install dependencies (after cloning upstream alongside these files)
npm install

# Lint
npm run lint

# Run the daemon locally
node scheduler.js

# Run a single platform script (upstream file)
node epic-games.js
```

Docker:
```bash
docker compose up -d          # start daemon
docker compose logs -f        # follow logs

# Manual trigger (no recreate needed)
curl -X POST http://localhost:8080/run

# Health status
curl http://localhost:8080/health
```

## Architecture

### Execution flow (daemon mode)

```
docker-entrypoint.sh (upstream: sets DISPLAY, starts TurboVNC + noVNC)
  └─ node scheduler.js
       ├─ HTTP server :8080  (GET /health, POST /run)
       ├─ node-cron fires at CRON_SCHEDULE (default: 0 7 * * * Europe/Warsaw)
       └─ for each platform: spawn("node", ["<script>.js"])
            └─ upstream script runs, calls notify() from src/util.js
```

### Notification pipeline

`src/util.js` exports two notification functions:

- `notify(html)` — existing Apprise CLI wrapper (unchanged from upstream)
- `notifyResult(platform, games)` — new wrapper that calls both Discord (`src/discord.js`) and Apprise in one call; use this in platform scripts instead of `notify()` to get empty/error Discord embeds

`src/discord.js` exports standalone functions for use in `scheduler.js`: `notifyJobStart`, `notifySuccess`, `notifyEmpty`, `notifyError`, `notifyJobSummary`. All are no-ops when `DISCORD_WEBHOOK` is unset, and swallow errors internally so a failed notification never crashes the claimer.

### Key env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRON_SCHEDULE` | `0 7 * * *` | When to run |
| `TZ` | `Europe/Warsaw` | Timezone for cron |
| `RUN_ON_START` | `0` | Set `1` to also run on container start |
| `HEALTH_PORT` | `8080` | Port for `/health` and `POST /run` |
| `DISCORD_WEBHOOK` | — | Discord webhook URL |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARN`/`ERROR` |

Credentials and Apprise `NOTIFY` are passed through to upstream scripts unchanged — see `.env.example`.

### Database

Upstream scripts use `lowdb` JSON files in `/fgc/data/` (volume `fgc_data`): `epic-games.json`, `gog.json`, `prime-gaming.json`, `steam.json`. These track claimed/failed/skipped games to avoid duplicate claims.

## GitHub

Repo: **https://github.com/DoSpamu/free-games-claimer**

Push changes after every modification:
```bash
git add <files>
git commit -m "description"
git push
```
