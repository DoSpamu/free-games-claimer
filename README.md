<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=7c3aed,06b6d4&height=160&section=header&text=&fontSize=0" />

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=26&duration=2800&pause=1000&color=E6EDF3&center=true&vCenter=true&width=620&lines=👾+free-games-claimer;Auto-claims+free+games+every+day;Epic+·+Prime+·+GOG+·+Steam+·+AliExpress;Discord+notifications+🔔;Deploy+with+Docker+🐳" alt="Typing SVG" />

<br/>

[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/DoSpamu/free-games-claimer)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/Discord-notifications-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.com)
[![License](https://img.shields.io/badge/license-MIT-238636?style=flat-square)](LICENSE)
[![Polish](https://img.shields.io/badge/🇵🇱-Polski-0d1117?style=flat-square)](README.pl.md)

<br/>

> Fork of [vogler/free-games-claimer]([(https://github.com/vogler/free-games-claimer)](https://github.com/vogler/free-games-claimer)) — adds Discord webhooks, slim Dockerfile and structured logging.

</div>

---

## ✨ What this fork adds

| | Feature | Details |
|:---:|---|---|
| 💬 | **Discord webhook** | 🟢 started · ✅ claimed · ℹ️ nothing to claim · ❌ error + screenshot |
| 🐳 | **Slim Dockerfile** | `FROM upstream` — builds in ~15 seconds |
| 📋 | **Structured logging** | Timestamps + INFO / WARN / ERROR in `docker logs` |
| ⏰ | **Daemon scheduler** | No cron needed — sleeps until next 07:00 |

---

## 🎮 Supported platforms

<div align="center">

| <img src="https://github.com/user-attachments/assets/82e9e9bf-b6ac-4f20-91db-36d2c8429cb6" width="40"/><br/>**Epic Games** | <img src="https://github.com/user-attachments/assets/7627a108-20c6-4525-a1d8-5d221ee89d6e" width="40"/><br/>**Prime Gaming** | <img src="https://github.com/user-attachments/assets/49040b50-ee14-4439-8e3c-e93cafd7c3a5" width="40"/><br/>**GOG** | <img src="https://github.com/user-attachments/assets/3582444b-f23b-448d-bf31-01668cd0313a" width="40"/><br/>**Steam** | 🛒<br/>**AliExpress** |
|:---:|:---:|:---:|:---:|:---:|
| Weekly | Monthly | Bi-weekly | Giveaways | Coupons |

</div>

---

## 🚀 Quick Start

### Step 1 — Discord webhook

1. Discord server → Channel settings → **Integrations** → **Webhooks** → **New webhook**
2. Copy the webhook URL

### Step 2 — Stack

**Portainer → Stacks → Add stack → Web editor**, paste and fill in your details:

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
    # sleep calculates seconds until next 07:00.
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
      - ALIEXPRESS_EMAIL=your@email.com
      - ALIEXPRESS_PASSWORD=yourpassword

      # ------ Other platforms (OPTIONAL) ------
      # Log in once manually via noVNC (http://IP:6080) — session is saved.
      # Or set credentials here for fully automatic login:
      # - EMAIL=your@email.com        # shared for all platforms
      # - PASSWORD=yourpassword
      # - EG_OTPKEY=                  # Epic Games 2FA key
      # - PG_OTPKEY=                  # Prime Gaming 2FA key
      # - STEAM_USERNAME=             # Steam login name (not email)
      # - STEAM_PASSWORD=

    healthcheck:
      test: curl --fail http://localhost:6080 || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3
```

> **First build** takes ~15 seconds — Portainer pulls the upstream image and applies this fork's overlay.

### Step 3 — First login

On first run each platform requires manual login:

1. Open `http://YOUR_IP:6080` — noVNC with Chromium browser
2. Log in in the open tabs or enter credentials in the terminal
3. The script waits `LOGIN_TIMEOUT` seconds (default 180s)

Session is saved in the volume (`/mnt/data`) — subsequent runs are fully automatic.

---

## 💬 Discord notifications

| Embed | When |
|-------|------|
| 🟢 **Container started** | At the beginning of every run |
| ✅ **Games claimed** | When a platform claims games (per platform) |
| ℹ️ **No new games** | When a platform has nothing to claim |
| ❌ **Error + screenshot** | When a platform script exits with an error |

> If `DISCORD_WEBHOOK` is not set — all Discord notifications are skipped, Apprise works normally.

---

## ⚙️ Environment variables

<details>
<summary><b>General</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `Europe/Warsaw` | Container timezone |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `SHOW` | `1` | Show browser in VNC |
| `VNC_PASSWORD` | — | Password for noVNC on `:6080` |
| `EMAIL` | — | Shared email for all platforms |
| `PASSWORD` | — | Shared password for all platforms |

</details>

<details>
<summary><b>Discord</b></summary>

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK` | Discord webhook URL (required for notifications) |

</details>

<details>
<summary><b>Epic Games</b></summary>

| Variable | Description |
|----------|-------------|
| `EG_EMAIL` | Epic Games email (overrides `EMAIL`) |
| `EG_PASSWORD` | Epic Games password |
| `EG_OTPKEY` | 2FA key — OTP generated automatically |

</details>

<details>
<summary><b>Prime Gaming</b></summary>

| Variable | Description |
|----------|-------------|
| `PG_EMAIL` | Prime Gaming email (overrides `EMAIL`) |
| `PG_PASSWORD` | Prime Gaming password |
| `PG_OTPKEY` | 2FA key — OTP generated automatically |

</details>

<details>
<summary><b>GOG</b></summary>

| Variable | Description |
|----------|-------------|
| `GOG_EMAIL` | GOG email (overrides `EMAIL`) |
| `GOG_PASSWORD` | GOG password |

</details>

<details>
<summary><b>Steam</b></summary>

| Variable | Description |
|----------|-------------|
| `STEAM_USERNAME` | Steam login name (not email) |
| `STEAM_PASSWORD` | Steam password |

</details>

<details>
<summary><b>AliExpress</b></summary>

| Variable | Description |
|----------|-------------|
| `ALIEXPRESS_EMAIL` | AliExpress email |
| `ALIEXPRESS_PASSWORD` | AliExpress password |

</details>

Full list of upstream options: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js)

---

## 🕐 Scheduling — no crontab needed

```
deploy at 15:00  →  scripts run immediately
                 →  sleep calculates: until tomorrow 07:00 = 16h
next day 07:00   →  container wakes up → scripts → sleep until next 07:00
and so on...
```

`TZ=Europe/Warsaw` makes `date` calculate time in the correct timezone.

**Override which platforms run:**

```yaml
# Only Prime Gaming and GOG:
command: bash -c "node run.js prime-gaming gog; sleep ..."

# All platforms:
command: bash -c "node run.js steam-games epic-games prime-gaming gog aliexpress; sleep ..."
```

Available scripts: `steam-games` · `epic-games` · `prime-gaming` · `gog` · `aliexpress`

---

## 🖥️ noVNC

Open `http://YOUR_IP:6080` in your browser — Chromium running inside the container. Useful for first login and debugging.

## 📋 Logs

```bash
docker logs free-games-claimer-dev -f
```

Or Portainer → Containers → `free-games-claimer-dev` → Logs.

---

## 📝 Changes from upstream

See [CHANGES.md](CHANGES.md).

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=7c3aed,06b6d4&height=100&section=footer" />
</div>
