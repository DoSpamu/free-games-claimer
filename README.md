# free-games-claimer — enhanced fork

Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) adds:

- **Discord webhook** — powiadomienia o odebranych grach jako embedded messages.
- **Slim Dockerfile** — `FROM upstream` zamiast full build; budowanie trwa ~15 sekund.
- **Structured logging** — timestampy, poziomy INFO/WARN/ERROR widoczne w `docker logs`.

Upstream obsługuje: Epic Games, Amazon Prime Gaming, GOG, Steam, AliExpress.

**Harmonogram:** `restart: unless-stopped` + `sleep 1d` na końcu komendy — kontener uruchamia się raz, robi co ma zrobić, zasypia na dobę, Docker restartuje go automatycznie.

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
    container_name: fgc
    build:
      context: https://github.com/DoSpamu/free-games-claimer.git#master
    restart: unless-stopped
    ports:
      - "6080:6080"   # noVNC — podgląd przeglądarki
    volumes:
      - fgc_data:/fgc/data

    # Wybierz platformy które chcesz — usuń lub dodaj skrypty w command.
    # sleep 1d + restart: unless-stopped = uruchamia się automatycznie co dobę.
    command: bash -c "node prime-gaming; node gog; node epic-games; node aliexpress; sleep 1d"

    environment:
      - LOG_LEVEL=INFO

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
      # - VNC_PASSWORD=tajnehaslo   # zalecane!

      # --- Apprise (alternatywne powiadomienia) ---
      # - NOTIFY=tgram://bottoken/chatid
      # - NOTIFY_TITLE=Free Games Claimer

    healthcheck:
      test: curl --fail http://localhost:6080 || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3

volumes:
  fgc_data:
```

> **Uwaga:** `build: context: https://github.com/...` wymaga dostępu do internetu i zajmuje ~15 sekund (slim build od upstream).

### Krok 3 — Pierwsze logowanie

Po starcie kontenera przeglądarki platform wymagają ręcznego zalogowania się **przy pierwszym uruchomieniu**. Sesja jest potem zapamiętana w wolumenie `fgc_data`.

1. Otwórz `http://TWOJ_IP:6080` — zobaczysz noVNC z przeglądarką
2. Wpisz dane logowania w terminalowym prompcie lub zaloguj się ręcznie w przeglądarce
3. Skrypt czeka `LOGIN_TIMEOUT` sekund (domyślnie 180s)

Po zalogowaniu sesja trwa i kolejne uruchomienia działają w pełni automatycznie.

---

## Wybór platform

Edytuj `command:` w docker-compose — dodaj lub usuń skrypty:

```yaml
# Tylko Prime Gaming i GOG:
command: bash -c "node prime-gaming; node gog; sleep 1d"

# Wszystkie dostępne:
command: bash -c "node steam-games; node epic-games; node prime-gaming; node gog; node aliexpress; sleep 1d"
```

---

## Zmienne środowiskowe

### Powiadomienia

| Zmienna | Opis |
|---------|------|
| `DISCORD_WEBHOOK` | URL Discord webhook — embed z listą odebranych gier |
| `NOTIFY` | Apprise URL — Telegram, Slack, email i inne (patrz [apprise docs](https://github.com/caronc/apprise)) |
| `NOTIFY_TITLE` | Opcjonalny tytuł powiadomień Apprise |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` (domyślnie `INFO`) |

### Dane logowania

Możesz ustawić wspólny `EMAIL` / `PASSWORD` dla wszystkich platform, lub osobne zmienne:

| Platforma | Email | Hasło | 2FA OTP key |
|-----------|-------|-------|-------------|
| Epic Games | `EG_EMAIL` | `EG_PASSWORD` | `EG_OTPKEY` |
| Prime Gaming | `PG_EMAIL` | `PG_PASSWORD` | `PG_OTPKEY` |
| GOG | `GOG_EMAIL` | `GOG_PASSWORD` | — |
| Steam | `STEAM_USERNAME` | `STEAM_PASSWORD` | — |

Pełna lista opcji: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js) w upstream repo.

---

## Podgląd przeglądarki (VNC)

Otwórz `http://TWOJ_IP:6080` — noVNC z podglądem Chromium w kontenerze. Przydatne przy pierwszym logowaniu lub debugowaniu.

Ustaw `VNC_PASSWORD` w env żeby zabezpieczyć dostęp.

---

## Logi

```bash
docker logs fgc -f
# lub w Portainerze: Containers → fgc → Logs
```

---

## Powiadomienia Discord

Wysyłane automatycznie przez `notify()` gdy skrypt platformy odbierze gry:

| Embed | Kiedy |
|-------|-------|
| ✅ **Odebrano gry** | Gdy platforma odbierze przynajmniej jedną grę |

---

## Różnice względem upstream

Patrz [CHANGES.md](CHANGES.md).
