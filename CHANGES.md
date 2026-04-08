# Changelog — DoSpamu/free-games-claimer

Zmiany względem upstream: [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/tree/enhanced)

---

## [Unreleased]

### Dodano

#### `scheduler.js` — daemon mode
- Kontener działa wiecznie — **zero `recreate` w Portainerze**
- `node-cron` uruchamia skrypty codziennie o godzinie z `CRON_SCHEDULE` (domyślnie `0 7 * * *`)
- Strefa czasowa konfigurowana przez `TZ` (domyślnie `Europe/Warsaw`)
- `RUN_ON_START=1` — opcjonalne natychmiastowe uruchomienie po starcie kontenera
- HTTP server na `HEALTH_PORT` (domyślnie `8080`):
  - `GET /health` — JSON ze statusem, czasem ostatniego uruchomienia, uptime
  - `POST /run` — ręczne uruchomienie bez restartu kontenera (zwraca `409` jeśli job już trwa)
- Logowanie startu/końca każdego joba z czasem wykonania
- Graceful shutdown na `SIGTERM`/`SIGINT`

#### `src/discord.js` — Discord webhook notifications
Powiadomienia przez Discord webhook (`DISCORD_WEBHOOK` env var). Wszystkie są no-op gdy zmienna nie jest ustawiona i nigdy nie przerywają działania claimera nawet przy błędzie sieci.

| Funkcja | Kiedy wysyłana | Kolor |
|---------|---------------|-------|
| `notifyFromHtml` | Przez `notify()` gdy coś odebrano | 🟢 zielony |
| `notifyJobStart` | Na początku każdego uruchomienia | 🟡 żółty |
| `notifyJobSummary` | Na końcu — digest wszystkich platform | zależny od wyniku |
| `notifyError` | Gdy skrypt platformy zakończy się błędem | 🔴 czerwony |
| `notifySuccess` | Platformy z odebranymi grami | 🟢 zielony |
| `notifyEmpty` | Brak nowych gier | 🔵 niebieski |

Funkcje używają retry z exponential backoff (3 próby: 1s, 2s, 4s) i timeout 10s per request.

#### `src/logger.js` — structured logging
- Timestampy na każdej linii (format: `2026-04-08 07:00:00.000`)
- Poziomy: `DEBUG` / `INFO` / `WARN` / `ERROR` (konfigurowane przez `LOG_LEVEL`)
- `logger.job(name)` — loguje start/koniec joba z czasem wykonania
- Logi `ERROR` idą na `stderr`, reszta na `stdout` — poprawna integracja z `docker logs`

#### Per-platform toggles
- `CLAIM_STEAM`, `CLAIM_EPIC`, `CLAIM_PRIME`, `CLAIM_GOG` — domyślnie `1`
- Ustaw `0` by pominąć daną platformę
- Na starcie scheduler loguje które platformy są aktywne
- Jeśli wszystkie wyłączone — kontener nie startuje z czytelnym błędem

### Zmieniono

#### `src/util.js` — `notify(html)`
- Oryginalna funkcja działa **bez zmian** (Apprise)
- Dodany side-effect: gdy `DISCORD_WEBHOOK` jest ustawiony, wysyła embed przez `notifyFromHtml`
- Fire-and-forget — błąd Discord'a nie wpływa na Apprise i nie przerywa skryptu
- HTML game list (`<a href>`, `<br>`) jest automatycznie konwertowany na Discord markdown

#### `Dockerfile`
- `CMD` zmieniony z `node steam-games; node epic-games; ...` na `node scheduler.js`
- Dodano `EXPOSE 8080`
- Dodano env defaults: `CRON_SCHEDULE`, `TZ`, `RUN_ON_START`, `LOG_LEVEL`, `HEALTH_PORT`
- Ulepszony `HEALTHCHECK` — sprawdza zarówno noVNC (`:6080`) jak i scheduler health (`:8080`)
- `--start-period=15s` żeby healthcheck nie failował podczas bootowania TurboVNC

#### `docker-compose.yml`
- Usunięto `command: bash -c "... sleep 1d"` — scheduler zastępuje pętlę
- Dodano port `8080:8080`
- Dodano zmienne: `DISCORD_WEBHOOK`, `CRON_SCHEDULE`, `TZ`, `RUN_ON_START`, `LOG_LEVEL`, `CLAIM_*`
- Ulepszony `healthcheck` z `start_period: 20s`

#### `package.json`
- Dodano dependency: `node-cron ^3.0.3`
- Dodano skrypt `"start": "node scheduler.js"`

### Nowe pliki

| Plik | Opis |
|------|------|
| `scheduler.js` | Daemon z node-cron + HTTP server |
| `src/discord.js` | Discord webhook module |
| `src/logger.js` | Structured logger |
| `.env.example` | Szablon konfiguracji |
| `README.md` | Dokumentacja (Portainer-focused) |
| `CLAUDE.md` | Wskazówki dla Claude Code |

---

## Upstream changelog

Zmiany w oryginalnym projekcie: [vogler/free-games-claimer](https://github.com/vogler/free-games-claimer/commits/main) oraz [p-adamiec/free-games-claimer](https://github.com/p-adamiec/free-games-claimer/commits/enhanced).
