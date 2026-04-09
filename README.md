# free-games-claimer — enhanced fork

Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) adds:

- **Discord webhook** — powiadomienia: kontener uruchomiony, odebrane gry, brak gier, błąd + screenshot.
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

    # Wybierz platformy — usuń lub dodaj nazwy skryptów.
    # run.js obsługuje powiadomienia Discord (start/brak gier/błąd+screenshot).
    # sleep 1d + restart: unless-stopped = uruchamia się automatycznie co dobę.
    command: bash -c "node run.js prime-gaming gog epic-games aliexpress; sleep 1d"

    environment:
      - LOG_LEVEL=INFO             # DEBUG | INFO | WARN | ERROR

      # ------ Discord webhook ------
      # - DISCORD_WEBHOOK=https://discord.com/api/webhooks/TWOJE_ID/TOKEN

      # ------ Apprise (alternatywne powiadomienia) ------
      # - NOTIFY=tgram://bottoken/chatid
      # - NOTIFY_TITLE=Free Games Claimer

      # ------ VNC ------
      - SHOW=1
      - WIDTH=1920
      - HEIGHT=1080
      # - VNC_PASSWORD=tajnehaslo   # zalecane — bez hasła noVNC jest otwarte!

      # ------ Dane logowania (OPCJONALNE) ------
      # Bez tych zmiennych: zaloguj się raz ręcznie przez VNC (http://IP:6080).
      # Sesja zostaje zapamiętana w wolumenie fgc_data — kolejne uruchomienia
      # działają automatycznie bez ponownego logowania.
      #
      # Podaj credentials tylko jeśli chcesz w pełni automatyczne logowanie
      # (przydatne zwłaszcza przy 2FA — skrypt sam generuje OTP z klucza).
      #
      # Wspólne dla wszystkich platform:
      # - EMAIL=twoj@email.com
      # - PASSWORD=haslo
      #
      # Lub osobne per platforma (nadpisują EMAIL/PASSWORD):
      # - EG_EMAIL=           # Epic Games
      # - EG_PASSWORD=
      # - EG_OTPKEY=          # klucz 2FA — skrypt sam generuje kod
      # - PG_EMAIL=           # Prime Gaming
      # - PG_PASSWORD=
      # - PG_OTPKEY=
      # - GOG_EMAIL=          # GOG
      # - GOG_PASSWORD=
      # - STEAM_USERNAME=     # Steam (login, nie email)
      # - STEAM_PASSWORD=

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

Edytuj `command:` w docker-compose — dodaj lub usuń nazwy skryptów:

```yaml
# Tylko Prime Gaming i GOG:
command: bash -c "node run.js prime-gaming gog; sleep 1d"

# Wszystkie dostępne:
command: bash -c "node run.js steam-games epic-games prime-gaming gog aliexpress; sleep 1d"
```

---

## Zmienne środowiskowe

### Powiadomienia

| Zmienna | Opis |
|---------|------|
| `DISCORD_WEBHOOK` | URL Discord webhook — embedy: start kontenera, odebrane gry, brak gier, błąd+screenshot |
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
| 🟢 **Kontener uruchomiony** | Na początku każdego uruchomienia — wiadomo że działa |
| ✅ **Odebrano gry** | Gdy platforma odbierze przynajmniej jedną grę |
| ℹ️ **Brak nowych gier** | Gdy platforma nie ma nic do odebrania |
| ❌ **Błąd + screenshot** | Gdy skrypt platformy zakończy się błędem |

---

## Różnice względem upstream

Patrz [CHANGES.md](CHANGES.md).
