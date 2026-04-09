# Changelog — DoSpamu/free-games-claimer

Zmiany względem upstream: [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/tree/enhanced)

---

## [Unreleased]

### Dodano

#### `run.js` — one-shot runner z powiadomieniami Discord
Zastępuje bezpośrednie wywołania `node epic-games; node gog; ...` w `command:`.  
Uruchamia każdą platformę po kolei i obsługuje powiadomienia których upstream nie wysyła:

| Powiadomienie | Kiedy |
|---------------|-------|
| 🟢 `notifyOnline` | Na początku każdego uruchomienia kontenera |
| ℹ️ `notifyEmpty` | Gdy skrypt zakończy się sukcesem ale brak nowych gier w DB |
| ❌ `notifyErrorWithScreenshot` | Gdy skrypt zakończy się błędem; dołącza najnowszy PNG z `data/screenshots/` |

Sukces (✅) obsługuje `util.notify()` w samych skryptach upstream — `run.js` tego nie duplikuje.  
Wykrywa odebranie gier przez porównanie liczby wpisów `status: "claimed"` w plikach lowdb przed i po uruchomieniu skryptu.

#### `src/discord.js` — Discord webhook notifications
Powiadomienia przez Discord webhook (`DISCORD_WEBHOOK` env var).  
Wszystkie są no-op gdy zmienna nie jest ustawiona i **nigdy** nie przerywają działania claimera.  
Retry z exponential backoff (3 próby: 1s, 2s, 4s), timeout 10s.

Eksportuje:
- `notifyFromHtml(title, html)` — konwertuje HTML game list na Discord markdown embed
- `notifyOnline(platforms)` — embed przy starcie kontenera
- `notifyEmpty(platforms)` — embed gdy brak nowych gier
- `notifyError(platform, error)` — embed z błędem
- `notifyErrorWithScreenshot(platform, error, path)` — jak wyżej + multipart upload PNG
- `notifySuccess`, `notifyJobSummary`, `notifyWeeklyDigest`, `notifyUpstreamUpdate` — dostępne, niezużywane

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
- Kopiuje tylko 4 pliki overlay: `src/discord.js`, `src/logger.js`, `src/util.js`, `run.js`
- Build: **~15 sekund** zamiast ~15 minut
- `CMD bash -c "node run.js prime-gaming gog epic-games aliexpress; sleep 1d"`
- `restart: unless-stopped` + `sleep 1d` = kontener uruchamia się automatycznie co dobę

#### `docker-compose.yml`
- `command: bash -c "node run.js prime-gaming gog epic-games aliexpress; sleep 1d"`
- Dodano `DISCORD_WEBHOOK` i `LOG_LEVEL` do env (zakomentowane — opcjonalne)
- Credentials zakomentowane z wyjaśnieniem że VNC login wystarczy
- Uproszczony `healthcheck` (tylko noVNC `:6080`)

### Nowe pliki

| Plik | Opis |
|------|------|
| `run.js` | One-shot runner z Discord notifications |
| `src/discord.js` | Discord webhook module |
| `src/logger.js` | Structured logger |
| `.env.example` | Szablon konfiguracji |
| `README.md` | Dokumentacja (Portainer-focused) |
| `CLAUDE.md` | Wskazówki dla Claude Code |

---

## Upstream changelog

[p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/commits/enhanced) |
[vogler/free-games-claimer:main](https://github.com/vogler/free-games-claimer/commits/main)
