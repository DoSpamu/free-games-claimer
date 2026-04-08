# free-games-claimer — enhanced fork

Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) adds:

- **Daemon mode** — kontener działa wiecznie, skrypty odpalaną się automatycznie o zadanej godzinie (domyślnie 07:00). Zero `recreate` w Portainerze.
- **Discord webhook** — powiadomienia o odebranych grach, braku ofert i błędach jako embedded messages.
- **Per-platform toggles** — włącz/wyłącz platformy przez env (`CLAIM_EPIC=0`).
- **HTTP health endpoint** — `GET /health` + `POST /run` (ręczne uruchomienie bez restartu kontenera).
- **Structured logging** — timestampy, poziomy INFO/WARN/ERROR widoczne w `docker logs`.

Upstream obsługuje: Epic Games, Amazon Prime Gaming, GOG, Steam.

---

## Wdrożenie w Portainerze

### Krok 1 — Discord webhook (opcjonalny, ale zalecany)

1. Wejdź na swój serwer Discord
2. Ustawienia kanału → **Integracje** → **Webhooks** → **Nowy webhook**
3. Skopiuj URL — będzie potrzebny w konfiguracji

### Krok 2 — Stack w Portainerze

**Stacks → Add stack → Web editor**, wklej poniższy plik i uzupełnij zmienne:

```yaml
services:
  free-games-claimer:
    image: ghcr.io/p-adamiec/free-games-claimer:enhanced
    container_name: fgc
    build:
      context: https://github.com/DoSpamu/free-games-claimer.git#master
    restart: unless-stopped
    ports:
      - "6080:6080"   # noVNC — podgląd przeglądarki
      - "8080:8080"   # health / ręczne uruchomienie
    volumes:
      - fgc_data:/fgc/data
    environment:
      # --- Scheduler ---
      - CRON_SCHEDULE=0 7 * * *
      - TZ=Europe/Warsaw
      - RUN_ON_START=0
      - LOG_LEVEL=INFO

      # --- Platformy (0 = wyłączona) ---
      - CLAIM_STEAM=1
      - CLAIM_EPIC=1
      - CLAIM_PRIME=1
      - CLAIM_GOG=1

      # --- Discord ---
      - DISCORD_WEBHOOK=https://discord.com/api/webhooks/TWOJE_ID/TOKEN

      # --- Dane logowania ---
      - EMAIL=twoj@email.com
      - PASSWORD=haslo

      # Epic Games
      - EG_EMAIL=
      - EG_PASSWORD=
      - EG_OTPKEY=

      # Prime Gaming
      - PG_EMAIL=
      - PG_PASSWORD=
      - PG_OTPKEY=

      # GOG
      - GOG_EMAIL=
      - GOG_PASSWORD=

      # Steam
      - STEAM_USERNAME=
      - STEAM_PASSWORD=

      # --- VNC ---
      - SHOW=1
      - WIDTH=1920
      - HEIGHT=1080
      # - VNC_PASSWORD=

      # --- Apprise (alternatywne powiadomienia) ---
      # - NOTIFY=tgram://bottoken/chatid
      # - NOTIFY_TITLE=Free Games Claimer

    healthcheck:
      test: >
        curl --fail http://localhost:6080 &&
        curl --fail http://localhost:8080/health
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3

volumes:
  fgc_data:
```

> **Uwaga:** `build: context: https://github.com/...` wymaga, żeby Portainer miał dostęp do internetu i mógł zbudować obraz. Przy pierwszym deploymencie build może zająć kilka minut.

### Krok 3 — Pierwsze logowanie

Po starcie kontenera przeglądarki platform wymagają ręcznego zalogowania się **przy pierwszym uruchomieniu**. Sesja jest potem zapamiętana w wolumenie `fgc_data`.

1. Otwórz `http://TWOJ_IP:6080` — zobaczysz noVNC z przeglądarką
2. Wpisz dane logowania w terminalowym prompcie lub zaloguj się ręcznie w przeglądarce
3. Skrypt czeka `LOGIN_TIMEOUT` sekund (domyślnie 180s)

Po zalogowaniu sesja trwa i kolejne uruchomienia powinny działać w pełni automatycznie.

---

## Zmienne środowiskowe

### Scheduler

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `CRON_SCHEDULE` | `0 7 * * *` | Harmonogram (format cron) |
| `TZ` | `Europe/Warsaw` | Strefa czasowa dla crona |
| `RUN_ON_START` | `0` | `1` = uruchom też od razu po starcie kontenera |
| `HEALTH_PORT` | `8080` | Port HTTP dla `/health` i `/run` |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARN` / `ERROR` |

### Platformy

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `CLAIM_STEAM` | `1` | `0` = pomiń Steam |
| `CLAIM_EPIC` | `1` | `0` = pomiń Epic Games |
| `CLAIM_PRIME` | `1` | `0` = pomiń Prime Gaming |
| `CLAIM_GOG` | `1` | `0` = pomiń GOG |

### Powiadomienia

| Zmienna | Opis |
|---------|------|
| `DISCORD_WEBHOOK` | URL Discord webhook (embeds: start / gry / błąd / podsumowanie) |
| `NOTIFY` | Apprise URL — Telegram, Slack, email i inne (patrz [apprise docs](https://github.com/caronc/apprise)) |
| `NOTIFY_TITLE` | Opcjonalny tytuł powiadomień Apprise |

### Dane logowania

Możesz ustawić wspólny `EMAIL` / `PASSWORD` dla wszystkich platform, lub osobne zmienne dla każdej:

| Platforma | Email | Hasło | 2FA OTP key |
|-----------|-------|-------|-------------|
| Epic Games | `EG_EMAIL` | `EG_PASSWORD` | `EG_OTPKEY` |
| Prime Gaming | `PG_EMAIL` | `PG_PASSWORD` | `PG_OTPKEY` |
| GOG | `GOG_EMAIL` | `GOG_PASSWORD` | — |
| Steam | `STEAM_USERNAME` | `STEAM_PASSWORD` | — |

Pełna lista opcji: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js) w upstream repo.

---

## Health check i ręczne uruchomienie

```bash
# Status schedulera
curl http://TWOJ_IP:8080/health

# Przykładowa odpowiedź:
# {
#   "status": "ok",
#   "running": false,
#   "lastRun": "2026-04-08T07:00:04.123Z",
#   "lastStatus": "ok",
#   "runCount": 5,
#   "schedule": "0 7 * * *",
#   "timezone": "Europe/Warsaw",
#   "uptime": 432001
# }

# Ręczne uruchomienie (bez restartu kontenera)
curl -X POST http://TWOJ_IP:8080/run
```

Portainer pokazuje stan healthchecku bezpośrednio na liście kontenerów.

---

## Podgląd przeglądarki (VNC)

Otwórz `http://TWOJ_IP:6080` — noVNC z podglądem tego co robi Chromium w kontenerze. Przydatne przy pierwszym logowaniu lub debugowaniu.

Opcjonalnie ustaw `VNC_PASSWORD` w env, żeby zabezpieczyć dostęp.

---

## Logi

```bash
docker logs fgc -f
# lub w Portainerze: Containers → fgc → Logs
```

Przykładowy output schedulera:

```
2026-04-08 07:00:00.000 [INFO ] Scheduler ready. Cron: "0 7 * * *" TZ: Europe/Warsaw
2026-04-08 07:00:00.001 [INFO ] Enabled platforms: Steam, Epic Games, Prime Gaming, GOG
2026-04-08 07:00:00.002 [INFO ] Health server listening on :8080
2026-04-08 07:00:00.003 [INFO ] >>> JOB START: Run #1
2026-04-08 07:00:00.004 [INFO ]   → Running: Steam (node steam-games.js)
...
2026-04-08 07:04:12.881 [INFO ] <<< JOB END:   Run #1 (252.88s)
```

---

## Powiadomienia Discord

Scheduler wysyła automatycznie:

| Embed | Kiedy |
|-------|-------|
| 🚀 **Job uruchomiony** | Na początku każdego uruchomienia |
| ✅ **Odebrano gry** | Gdy skrypt platformy odbierze gry (przez `notify()`) |
| 📋 **Podsumowanie** | Na końcu każdego uruchomienia |
| ❌ **Błąd** | Gdy skrypt platformy zakończy się z błędem |

---

## Różnice względem upstream

Patrz [CHANGES.md](CHANGES.md).
