# free-games-claimer — enhanced fork

Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer).

## Co dodaje ten fork

- **Discord webhook** — powiadomienia: 🟢 start kontenera, ✅ odebrane gry, ℹ️ brak gier, ❌ błąd + screenshot
- **Slim Dockerfile** — `FROM upstream`, build trwa ~15 sekund
- **Structured logging** — timestampy i poziomy INFO/WARN/ERROR w `docker logs`

Upstream obsługuje: Epic Games, Amazon Prime Gaming, GOG, Steam, AliExpress.

---

## Wdrożenie w Portainerze

### Krok 1 — Discord webhook

1. Serwer Discord → Ustawienia kanału → **Integracje** → **Webhooks** → **Nowy webhook**
2. Skopiuj URL webhooka

### Krok 2 — Stack

**Stacks → Add stack → Web editor**, wklej i uzupełnij swoje dane:

```yaml
services:
  free-games-claimer:
    container_name: free-games-claimer-dev
    build:
      context: https://github.com/DoSpamu/free-games-claimer.git#master
    restart: unless-stopped
    ports:
      - "6080:6080"   # noVNC — podgląd przeglądarki
      - "5900:5900"   # VNC
    volumes:
      - /mnt/data:/fgc/data

    # Wybierz platformy — usuń lub dodaj nazwy skryptów.
    # sleep liczy sekundy do następnego 07:00 — kontener budzi się zawsze o tej porze.
    command: >
      bash -c "node run.js prime-gaming gog epic-games aliexpress;
      sleep $$(( $$(date -d 'tomorrow 07:00' +%s) - $$(date +%s) ))s"

    environment:
      - TZ=Europe/Warsaw
      - SHOW=1
      - LOG_LEVEL=INFO

      # ------ Discord (wymagany dla powiadomień) ------
      - DISCORD_WEBHOOK=https://discord.com/api/webhooks/TWOJE_ID/TOKEN

      # ------ VNC ------
      # - VNC_PASSWORD=tajnehaslo   # zalecane!

      # ------ AliExpress ------
      # Bez credentials skrypt zakończy się błędem logowania
      - ALIEXPRESS_EMAIL=twoj@email.com
      - ALIEXPRESS_PASSWORD=twoje_haslo

      # ------ Pozostałe platformy (OPCJONALNE) ------
      # Bez tych zmiennych: zaloguj się raz ręcznie przez VNC (http://IP:6080).
      # Sesja zapisuje się w wolumenie — kolejne uruchomienia działają automatycznie.
      #
      # Wspólne dla wszystkich:
      # - EMAIL=twoj@email.com
      # - PASSWORD=twoje_haslo
      #
      # Lub per platforma:
      # - EG_EMAIL=          # Epic Games
      # - EG_PASSWORD=
      # - EG_OTPKEY=         # klucz 2FA — skrypt sam generuje kod OTP
      # - PG_EMAIL=          # Prime Gaming
      # - PG_PASSWORD=
      # - PG_OTPKEY=
      # - GOG_EMAIL=         # GOG
      # - GOG_PASSWORD=
      # - STEAM_USERNAME=    # Steam (login, nie email)
      # - STEAM_PASSWORD=

    healthcheck:
      test: curl --fail http://localhost:6080 || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3
```

> **Build przy pierwszym deploy** trwa ~15 sekund — Portainer pobiera upstream image i kopiuje nasze pliki.

### Krok 3 — Pierwsze logowanie

Przy pierwszym uruchomieniu każda platforma wymaga ręcznego zalogowania:

1. Otwórz `http://TWOJ_IP:6080` — noVNC z przeglądarką Chromium
2. Zaloguj się ręcznie w otwartych kartach lub wpisz dane w terminalu
3. Skrypt czeka `LOGIN_TIMEOUT` sekund (domyślnie 180s)

Sesja zapisuje się w wolumenie (`/mnt/data`) — następne uruchomienia są w pełni automatyczne.

---

## Harmonogram — bez crontab

```
deploy o 15:00  → skrypty się wykonują od razu
                → sleep liczy: do jutrzejszego 07:00 = 16h
następny dzień 07:00 → kontener się budzi → skrypty → sleep do kolejnego 07:00
i tak w kółko
```

`TZ=Europe/Warsaw` sprawia że `date` liczy czas w polskiej strefie.

---

## Wybór platform

Edytuj `command:` — dodaj lub usuń nazwy skryptów:

```yaml
# Tylko Prime Gaming i GOG:
command: bash -c "node run.js prime-gaming gog; sleep ..."

# Wszystkie dostępne:
command: bash -c "node run.js steam-games epic-games prime-gaming gog aliexpress; sleep ..."
```

Dostępne skrypty: `steam-games`, `epic-games`, `prime-gaming`, `gog`, `aliexpress`

---

## Powiadomienia Discord

| Embed | Kiedy |
|-------|-------|
| 🟢 **Kontener uruchomiony** | Na początku każdego uruchomienia |
| ✅ **Odebrano gry** | Gdy platforma odbierze gry (per platforma) |
| ℹ️ **Brak nowych gier** | Gdy platforma nie ma nic do odebrania |
| ❌ **Błąd + screenshot** | Gdy skrypt platformy zakończy się błędem |

Jeśli `DISCORD_WEBHOOK` nie jest ustawiony — wszystkie powiadomienia Discord są pomijane, Apprise działa normalnie.

---

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| `DISCORD_WEBHOOK` | URL webhooka Discord |
| `TZ` | Strefa czasowa (domyślnie `Europe/Warsaw`) |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `SHOW` | `1` = pokaż przeglądarkę w VNC |
| `VNC_PASSWORD` | Hasło do noVNC na `:6080` |

Pełna lista opcji upstream: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js)

---

## VNC

`http://TWOJ_IP:6080` — noVNC z przeglądarką. Działa cały czas w tle (minimalne zasoby), przydatne przy pierwszym logowaniu i debugowaniu.

## Logi

```bash
docker logs free-games-claimer-dev -f
# lub Portainer → Containers → free-games-claimer-dev → Logs
```

---

## Różnice względem upstream

Patrz [CHANGES.md](CHANGES.md).
