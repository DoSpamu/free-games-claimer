# Changelog — DoSpamu/free-games-claimer

Zmiany względem upstream: [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/tree/enhanced)

---

## [Unreleased]

### Nowe pliki

#### `run.js` — one-shot runner z powiadomieniami Discord

Zastępuje bezpośrednie wywołania `node epic-games; node gog; ...` w `command:`.  
Uruchamia każdą platformę po kolei i obsługuje powiadomienia:

| Powiadomienie | Kiedy |
|---------------|-------|
| 🟢 `notifyOnline` | Na początku każdego uruchomienia kontenera |
| ℹ️ `notifyEmpty` | Gdy skrypt zakończy się sukcesem ale brak nowych gier w DB |
| ❌ `notifyErrorWithScreenshot` | Gdy skrypt zakończy się błędem; dołącza najnowszy PNG z `data/screenshots/` |

Sukces (✅) obsługuje `util.notify()` w samych skryptach upstream — `run.js` tego nie duplikuje.  
Wykrywa odebranie gier przez porównanie liczby wpisów `status: "claimed"` w plikach lowdb przed i po uruchomieniu.

`NONZERO_IS_EMPTY` — zbiór skryptów które kończą się kodem `!= 0` nawet gdy działają poprawnie (np. `aliexpress` gdy brak monet). Dla nich kod `!= 0` traktowany jest jako "brak czegoś do zrobienia", nie jako błąd.

#### `src/discord.js` — Discord webhook notifications

Powiadomienia przez Discord webhook (`DISCORD_WEBHOOK` env var).  
Wszystkie funkcje są no-op gdy zmienna nie jest ustawiona i **nigdy** nie przerywają działania claimera.  
Retry z exponential backoff (3 próby: 1s, 2s, 4s), timeout 10s na żądanie JSON / 15s na upload pliku.

Eksportuje:
- `notifyFromHtml(title, html)` — konwertuje HTML game list na Discord markdown embed; wywoływany automatycznie przez `util.notify()`
- `notifyOnline(platforms)` — 🟢 embed przy starcie kontenera
- `notifyEmpty(platforms)` — ℹ️ embed gdy brak nowych gier
- `notifyError(platform, error)` — ❌ embed z błędem
- `notifyErrorWithScreenshot(platform, error, path)` — ❌ embed + multipart upload PNG
- `notifyJobStart`, `notifySuccess`, `notifyJobSummary`, `notifyWeeklyDigest`, `notifyUpstreamUpdate` — dostępne, niezużywane

#### `src/logger.js` — structured logging

- Timestamp na każdej linii (format: `2026-04-09 07:00:00.000`)
- Poziomy: `DEBUG` / `INFO` / `WARN` / `ERROR` (przez `LOG_LEVEL` env var)
- `ERROR` → `stderr`, reszta → `stdout`
- `logger.job(name)` — pomocnik do mierzenia czasu zadań

---

### Zmienione pliki

#### `src/util.js` — `notify(html)`

- Oryginalna funkcja działa **bez zmian** (Apprise)
- Dodany side-effect: Discord embed przez `notifyFromHtml` gdy `DISCORD_WEBHOOK` ustawiony
- Fire-and-forget — błąd Discord nie wpływa na Apprise i nie przerywa skryptu

#### `Dockerfile` — slim build

- **`FROM ghcr.io/p-adamiec/free-games-claimer:enhanced`** zamiast `FROM ubuntu:noble`
- Kopiuje tylko 4 pliki overlay: `run.js`, `src/discord.js`, `src/logger.js`, `src/util.js`
- Build: **~15 sekund** zamiast ~15 minut
- `CMD bash -c "node run.js prime-gaming gog epic-games aliexpress; sleep 1d"`

#### `docker-compose.yml`

- `command:` z `sleep $(( $(date -d 'tomorrow 07:00' +%s) - $(date +%s) ))s` — kontener budzi się codziennie o 07:00
- `restart: unless-stopped` — automatyczny restart po zakończeniu sleep
- `DISCORD_WEBHOOK`, `LOG_LEVEL`, `ALIEXPRESS_EMAIL`, `ALIEXPRESS_PASSWORD` w env
- Credentials dla pozostałych platform zakomentowane z wyjaśnieniem (VNC login wystarczy)

---

## Upstream changelog

[p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer/commits/enhanced) |
[vogler/free-games-claimer:main](https://github.com/vogler/free-games-claimer/commits/main)
