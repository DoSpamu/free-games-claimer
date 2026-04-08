# Zmiany względem upstream (p-adamiec/free-games-claimer:enhanced)

## Nowe pliki

| Plik | Opis |
|------|------|
| `scheduler.js` | Daemon z node-cron – kontener żyje wiecznie, skrypt odpala się o 07:00 |
| `src/discord.js` | Moduł Discord webhook (success / empty / error / summary) |
| `src/logger.js` | Logger ze znacznikami czasu i poziomami INFO/WARN/ERROR/DEBUG |
| `.env.example` | Przykładowy plik konfiguracyjny |

## Zmodyfikowane pliki

### `package.json`
- Dodano `node-cron ^3.0.3`
- Dodano skrypt `"start": "node scheduler.js"`

### `Dockerfile`
- Zmieniono `CMD` z `node steam-games; node epic-games; ...` na `node scheduler.js`
- Dodano `EXPOSE 8080` (health endpoint)
- Dodano env: `CRON_SCHEDULE`, `TZ`, `RUN_ON_START`, `LOG_LEVEL`, `HEALTH_PORT`
- Ulepszono `HEALTHCHECK` (sprawdza też `/health` na port 8080)

### `docker-compose.yml`
- Usunięto `command:` (scheduler zastępuje pętlę `sleep 1d`)
- Dodano port `8080:8080`
- Dodano zmienne środowiskowe: `DISCORD_WEBHOOK`, `CRON_SCHEDULE`, `TZ`, `RUN_ON_START`, `LOG_LEVEL`
- Ulepszono `healthcheck`

### `src/util.js`
- Dodano `notifyResult(platform, games)` – wysyła Discord + Apprise w jednym wywołaniu
- Istniejąca `notify()` pozostaje niezmieniona

## Jak używać

### 1. Discord webhook
Wejdź na swój serwer Discord → Ustawienia kanału → Integracje → Webhooks → Utwórz webhook → skopiuj URL.

```yaml
# docker-compose.yml
environment:
  - DISCORD_WEBHOOK=https://discord.com/api/webhooks/123456/abcdef
```

### 2. Harmonogram
```yaml
environment:
  - CRON_SCHEDULE=0 7 * * *   # codziennie o 07:00
  - TZ=Europe/Warsaw
  - RUN_ON_START=1             # uruchom też od razu po starcie
```

### 3. Ręczne uruchomienie
```bash
curl -X POST http://localhost:8080/run
```

### 4. Health check
```bash
curl http://localhost:8080/health
# {
#   "status": "ok",
#   "running": false,
#   "lastRun": "2026-04-08T07:00:01.234Z",
#   "lastStatus": "ok",
#   "runCount": 3,
#   "schedule": "0 7 * * *",
#   "timezone": "Europe/Warsaw",
#   "uptime": 86400
# }
```

### 5. Pojedynczy skrypt (debug)
```bash
docker exec fgc node epic-games.js
# lub nadpisz CMD:
docker run ... node epic-games.js
```

### 6. Integracja notifyResult w skryptach platform
Aby skrypt platformy wysyłał powiadomienia "brak gier", zmień wywołanie `notify()` na `notifyResult()`:

```js
// PRZED (tylko gdy coś odebrano):
if (newGames.length) await notify(html_game_list(newGames));

// PO (zawsze: success / empty / error):
import { notifyResult } from './src/util.js';
await notifyResult('Epic Games', allGames); // allGames zawiera też status='skipped'/'claimed'/'failed'
```
