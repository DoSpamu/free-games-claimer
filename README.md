> 🇵🇱 [Polish version](README.pl.md)

# free-games-claimer — enhanced fork

Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer).

## What this fork adds

- **Discord webhook** — notifications: 🟢 container started, ✅ games claimed, ℹ️ nothing to claim, ❌ error + screenshot
- **Slim Dockerfile** — `FROM upstream`, build takes ~15 seconds
- **Structured logging** — timestamps and INFO/WARN/ERROR levels in `docker logs`

Upstream supports: Epic Games, Amazon Prime Gaming, GOG, Steam, AliExpress.

---

## Deploying with Portainer

### Step 1 — Discord webhook

1. Discord server → Channel settings → **Integrations** → **Webhooks** → **New webhook**
2. Copy the webhook URL

### Step 2 — Stack

**Stacks → Add stack → Web editor**, paste and fill in your details:

```yaml
services:
  free-games-claimer:
    container_name: free-games-claimer-dev
    build:
      context: https://github.com/DoSpamu/free-games-claimer.git#master
    restart: unless-stopped
    ports:
      - "6080:6080"   # noVNC — browser preview
      - "5900:5900"   # VNC
    volumes:
      - /mnt/data:/fgc/data

    # Choose platforms — remove or add script names.
    # sleep calculates seconds until next 07:00 — container always wakes at that time.
    command: >
      bash -c "node run.js prime-gaming gog epic-games aliexpress;
      sleep $$(( $$(date -d 'tomorrow 07:00' +%s) - $$(date +%s) ))s"

    environment:
      - TZ=Europe/Warsaw
      - SHOW=1
      - LOG_LEVEL=INFO

      # ------ Discord (required for notifications) ------
      - DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_ID/TOKEN

      # ------ VNC ------
      # - VNC_PASSWORD=secretpassword   # recommended!

      # ------ AliExpress ------
      # Without credentials the script will fail at login
      - ALIEXPRESS_EMAIL=your@email.com
      - ALIEXPRESS_PASSWORD=yourpassword

      # ------ Other platforms (OPTIONAL) ------
      # Without these variables: log in once manually via VNC (http://IP:6080).
      # Session is saved in the volume — subsequent runs work automatically.
      #
      # Shared for all platforms:
      # - EMAIL=your@email.com
      # - PASSWORD=yourpassword
      #
      # Or per platform:
      # - EG_EMAIL=          # Epic Games
      # - EG_PASSWORD=
      # - EG_OTPKEY=         # 2FA key — script generates OTP automatically
      # - PG_EMAIL=          # Prime Gaming
      # - PG_PASSWORD=
      # - PG_OTPKEY=
      # - GOG_EMAIL=         # GOG
      # - GOG_PASSWORD=
      # - STEAM_USERNAME=    # Steam (login name, not email)
      # - STEAM_PASSWORD=

    healthcheck:
      test: curl --fail http://localhost:6080 || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3
```

> **First deploy build** takes ~15 seconds — Portainer pulls the upstream image and copies our overlay files.

### Step 3 — First login

On first run each platform requires manual login:

1. Open `http://YOUR_IP:6080` — noVNC with Chromium browser
2. Log in manually in the open tabs or enter credentials in the terminal
3. The script waits `LOGIN_TIMEOUT` seconds (default 180s)

Session is saved in the volume (`/mnt/data`) — subsequent runs are fully automatic.

---

## Scheduling — no crontab needed

```
deploy at 15:00  → scripts run immediately
                 → sleep calculates: until tomorrow 07:00 = 16h
next day 07:00   → container wakes up → scripts → sleep until next 07:00
and so on
```

`TZ=Europe/Warsaw` makes `date` calculate time in the Polish timezone.

---

## Choosing platforms

Edit `command:` — add or remove script names:

```yaml
# Only Prime Gaming and GOG:
command: bash -c "node run.js prime-gaming gog; sleep ..."

# All available:
command: bash -c "node run.js steam-games epic-games prime-gaming gog aliexpress; sleep ..."
```

Available scripts: `steam-games`, `epic-games`, `prime-gaming`, `gog`, `aliexpress`

---

## Discord notifications

| Embed | When |
|-------|------|
| 🟢 **Container started** | At the beginning of every run |
| ✅ **Games claimed** | When a platform claims games (per platform) |
| ℹ️ **No new games** | When a platform has nothing to claim |
| ❌ **Error + screenshot** | When a platform script exits with an error |

If `DISCORD_WEBHOOK` is not set — all Discord notifications are skipped, Apprise works normally.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK` | Discord webhook URL |
| `TZ` | Timezone (default `Europe/Warsaw`) |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `SHOW` | `1` = show browser in VNC |
| `VNC_PASSWORD` | Password for noVNC on `:6080` |

Full list of upstream options: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js)

---

## VNC

`http://YOUR_IP:6080` — noVNC with browser. Runs in the background at all times (minimal resources), useful for first login and debugging.

## Logs

```bash
docker logs free-games-claimer-dev -f
# or Portainer → Containers → free-games-claimer-dev → Logs
```

---

## Changes from upstream

See [CHANGES.md](CHANGES.md).
