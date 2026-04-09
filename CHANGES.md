# Changelog — DoSpamu/free-games-claimer

Zmiany względem upstream: [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/tree/enhanced)

---

## [Unreleased]

### Dodano

#### `src/discord.js` — Discord webhook notifications
Powiadomienia przez Discord webhook (`DISCORD_WEBHOOK` env var).  
Wszystkie są no-op gdy zmienna nie jest ustawiona i **nigdy** nie przerywają działania claimera.

| Funkcja | Kiedy wysyłana |
|---------|---------------|
| `notifyFromHtml(title, html)` | Automatycznie przez `util.notify()` gdy platforma odbierze gry |

Retry z exponential backoff (3 próby: 1s, 2s, 4s), timeout 10s per request.

#### `src/logger.js` — structured logging
- Timestampy na każdej linii (format: `2026-04-09 07:00:00.000`)
- Poziomy: `DEBUG` / `INFO` / `WARN` / `ERROR` (przez `LOG_LEVEL`)
- `ERROR` → `stderr`, reszta → `stdout`

### Zmieniono

#### `src/util.js` — `notify(html)`
- Oryginalna funkcja działa **bez zmian** (Apprise)
- Dodany side-effect: Discord embed przez `notifyFromHtml` gdy `DISCORD_WEBHOOK` ustawiony
- Fire-and-forget — błąd Discord nie wpływa na Apprise i nie przerywa skryptu
- HTML game list (`<a href>`, `<br>`) automatycznie konwertowany na Discord markdown

#### `Dockerfile` — slim build
- **`FROM ghcr.io/p-adamiec/free-games-claimer:enhanced`** zamiast `FROM ubuntu:noble`
- Kopiuje tylko 3 pliki overlay (`src/discord.js`, `src/logger.js`, `src/util.js`)
- Build: **~15 sekund** zamiast ~15 minut
- `CMD bash -c "node prime-gaming; node gog; node epic-games; node aliexpress; sleep 1d"`
- `restart: unless-stopped` + `sleep 1d` = kontener uruchamia się automatycznie co dobę

#### `docker-compose.yml`
- Dodano `DISCORD_WEBHOOK` i `LOG_LEVEL` do env
- `command:` z listą platform do wyboru + `sleep 1d`
- Uproszczony `healthcheck` (tylko noVNC `:6080`)

### Nowe pliki

| Plik | Opis |
|------|------|
| `src/discord.js` | Discord webhook module |
| `src/logger.js` | Structured logger |
| `.env.example` | Szablon konfiguracji |
| `README.md` | Dokumentacja (Portainer-focused) |
| `CLAUDE.md` | Wskazówki dla Claude Code |

---

## Upstream changelog

[p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/commits/enhanced) |
[vogler/free-games-claimer:main](https://github.com/vogler/free-games-claimer/commits/main)
