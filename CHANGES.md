# Changelog — DoSpamu/free-games-claimer

Zmiany względem upstream: [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/tree/enhanced)

---

## [Unreleased]

### Dodano

#### Daemon mode (`scheduler.js`)
- Kontener działa wiecznie — **zero `recreate` w Portainerze**
- `node-cron` uruchamia skrypty codziennie wg `CRON_SCHEDULE` (domyślnie `0 7 * * *`)
- Strefa czasowa przez `TZ` (domyślnie `Europe/Warsaw`)
- `RUN_ON_START=1` — opcjonalne natychmiastowe uruchomienie po starcie
- HTTP server na `HEALTH_PORT` (domyślnie `8080`):
  - `GET /health` — JSON ze statusem, czasem ostatniego uruchomienia, uptime
  - `POST /run` — ręczne uruchomienie bez restartu kontenera (`409` jeśli job trwa)
- Graceful shutdown: czyści retry timery, czeka do 30s na kończący się job

#### Retry po błędzie
- Jeśli platforma zakończy się z kodem ≠ 0, scheduler automatycznie ponawia ją po 30 minutach
- Wyłączalne przez `RETRY_FAILED=0`
- Powiadomienie Discord jeśli retry też nie powiedzie

#### Per-platform toggles
- `CLAIM_STEAM`, `CLAIM_EPIC`, `CLAIM_PRIME`, `CLAIM_GOG` — domyślnie `1`
- Ustaw `0` by pominąć daną platformę
- Na starcie scheduler loguje aktywne platformy; jeśli wszystkie wyłączone — exit z błędem

#### Walidacja credentials przy starcie
- Sprawdza czy każda **włączona** platforma ma skonfigurowane dane logowania
- Wyświetla `WARN` w logach jeśli brakuje — bez czekania do 07:00 na błąd

#### Ostrzeżenie VNC bez hasła
- `WARN` przy starcie gdy `VNC_PASSWORD` nie jest ustawione
- noVNC na `:6080` jest wtedy dostępne bez uwierzytelnienia

#### Sprawdzanie wersji upstream
- Na starcie odpytuje GitHub API o najnowszy commit `p-adamiec/free-games-claimer:enhanced`
- Porównuje z ostatnio zapamiętanym SHA (`data/upstream-sha.txt`)
- Jeśli wykryje nowe commity: log + embed Discord `🔄 Dostępna aktualizacja upstream`

#### Weekly digest (niedziela 10:00)
- Osobny cron `0 10 * * 0` czyta pliki `data/*.json` (lowdb)
- Liczy gry odebrane w ostatnich 7 dniach per platforma
- Wysyła embed `📅 Tygodniowe podsumowanie` na Discord
- Wyłączalne przez `WEEKLY_DIGEST=0`

#### Screenshot w powiadomieniu błędu
- Po błędzie skryptu platformy scheduler szuka najnowszego `.png` w `data/screenshots/`
- Dołącza go jako attachment do embeda `❌ Błąd` przez Discord multipart upload
- Fallback do embeda bez obrazka jeśli screenshot nie istnieje / nie jest czytelny

#### Powiadomienie o starcie kontenera
- Embed `🟢 Claimer online` wysyłany raz przy każdym uruchomieniu kontenera
- Zawiera listę aktywnych platform i harmonogram

#### `src/discord.js` — nowe funkcje
| Funkcja | Opis |
|---------|------|
| `notifyOnline` | Container started |
| `notifyErrorWithScreenshot` | Błąd + PNG attachment (multipart upload) |
| `notifyWeeklyDigest` | Tygodniowe podsumowanie |
| `notifyUpstreamUpdate` | Nowe commity w upstream repo |

Wszystkie funkcje są no-op gdy `DISCORD_WEBHOOK` nie jest ustawiony i nigdy nie przerywają działania claimera.

#### `src/logger.js`
- Timestampy na każdej linii
- Poziomy: `DEBUG` / `INFO` / `WARN` / `ERROR` (przez `LOG_LEVEL`)
- `logger.job(name)` — loguje start/koniec z czasem wykonania
- `ERROR` → `stderr`, reszta → `stdout`

### Zmieniono

#### `Dockerfile` — slim build
- **`FROM ghcr.io/p-adamiec/free-games-claimer:enhanced`** zamiast `FROM ubuntu:noble`
- Kopiuje tylko 4 pliki overlay + instaluje `node-cron`
- Build: **~15 sekund** zamiast ~15 minut
- `CMD node scheduler.js`
- `EXPOSE 8080`
- Nowe env defaults: `CRON_SCHEDULE`, `TZ`, `RUN_ON_START`, `RETRY_FAILED`, `WEEKLY_DIGEST`, `LOG_LEVEL`
- `HEALTHCHECK` sprawdza zarówno noVNC (`:6080`) jak i scheduler (`:8080`)

#### `docker-compose.yml`
- Usunięto `command: bash -c "... sleep 1d"` — zastąpione przez scheduler
- Dodano port `8080:8080`
- Dodano zmienne: `DISCORD_WEBHOOK`, `CRON_SCHEDULE`, `TZ`, `RETRY_FAILED`, `WEEKLY_DIGEST`, `CLAIM_*`
- `build.context` wskazuje bezpośrednio na repo GitHub

#### `src/util.js` — `notify(html)`
- Oryginalna funkcja działa **bez zmian** (Apprise)
- Dodany side-effect: Discord embed przez `notifyFromHtml` gdy `DISCORD_WEBHOOK` ustawiony
- Fire-and-forget — błąd Discord nie wpływa na Apprise

#### `package.json`
- Dodano: `node-cron ^3.0.3`
- Dodano skrypt: `"start": "node scheduler.js"`

### Nowe pliki

| Plik | Opis |
|------|------|
| `scheduler.js` | Daemon — node-cron + HTTP server + retry + weekly digest |
| `src/discord.js` | Discord webhook module |
| `src/logger.js` | Structured logger |
| `.env.example` | Szablon konfiguracji |
| `README.md` | Dokumentacja (Portainer-focused) |
| `CLAUDE.md` | Wskazówki dla Claude Code |

---

## Upstream changelog

[p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/commits/enhanced) |
[vogler/free-games-claimer:main](https://github.com/vogler/free-games-claimer/commits/main)
