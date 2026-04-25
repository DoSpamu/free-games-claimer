<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=7c3aed,06b6d4&height=160&section=header&text=&fontSize=0" />

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=26&duration=2800&pause=1000&color=E6EDF3&center=true&vCenter=true&width=620&lines=👾+free-games-claimer;Automatycznie+odbiera+darmowe+gry;Epic+·+Prime+·+GOG+·+Steam+·+AliExpress;Powiadomienia+Discord+🔔;Uruchom+przez+Docker+🐳" alt="Typing SVG" />

<br/>

[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/DoSpamu/free-games-claimer)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/Discord-powiadomienia-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.com)
[![Licencja](https://img.shields.io/badge/licencja-MIT-238636?style=flat-square)](LICENSE)
[![English](https://img.shields.io/badge/🇬🇧-English-0d1117?style=flat-square)](README.md)

<br/>

> Fork of [p-adamiec/free-games-claimer:enhanced](https://github.com/p-adamiec/free-games-claimer) — dodaje Discord webhooks, slim Dockerfile i structured logging.

</div>

---

## ✨ Co dodaje ten fork

| | Funkcja | Szczegóły |
|:---:|---|---|
| 💬 | **Discord webhook** | 🟢 start · ✅ odebrano · ℹ️ brak gier · ❌ błąd + screenshot |
| 🐳 | **Slim Dockerfile** | `FROM upstream` — build w ~15 sekund |
| 📋 | **Structured logging** | Timestampy + INFO / WARN / ERROR w `docker logs` |
| ⏰ | **Daemon scheduler** | Bez crona — sleep do następnego 07:00 |

---

## 🎮 Obsługiwane platformy

<div align="center">

| <img src="https://github.com/user-attachments/assets/82e9e9bf-b6ac-4f20-91db-36d2c8429cb6" width="40"/><br/>**Epic Games** | <img src="https://github.com/user-attachments/assets/7627a108-20c6-4525-a1d8-5d221ee89d6e" width="40"/><br/>**Prime Gaming** | <img src="https://github.com/user-attachments/assets/49040b50-ee14-4439-8e3c-e93cafd7c3a5" width="40"/><br/>**GOG** | <img src="https://github.com/user-attachments/assets/3582444b-f23b-448d-bf31-01668cd0313a" width="40"/><br/>**Steam** | 🛒<br/>**AliExpress** |
|:---:|:---:|:---:|:---:|:---:|
| Co tydzień | Co miesiąc | Co kilka tygodni | Wyprzedaże | Kupony |

</div>

---

## 🚀 Quick Start

### Krok 1 — Discord webhook

1. Serwer Discord → Ustawienia kanału → **Integracje** → **Webhooks** → **Nowy webhook**
2. Skopiuj URL webhooka

### Krok 2 — Stack

**Portainer → Stacks → Add stack → Web editor**, wklej i uzupełnij swoje dane:

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
    # sleep liczy sekundy do następnego 07:00.
    command: >
      bash -c "node run.js prime-gaming gog epic-games aliexpress;
      sleep $$(( $$(date -d 'tomorrow 07:00' +%s) - $$(date +%s) ))s"

    environment:
      - TZ=Europe/Warsaw
      - SHOW=1
      - LOG_LEVEL=INFO

      # ------ Discord (wymagany do powiadomień) ------
      - DISCORD_WEBHOOK=https://discord.com/api/webhooks/TWOJE_ID/TOKEN

      # ------ VNC ------
      # - VNC_PASSWORD=tajnehaslo   # zalecane!

      # ------ AliExpress ------
      - ALIEXPRESS_EMAIL=twoj@email.com
      - ALIEXPRESS_PASSWORD=twoje_haslo

      # ------ Pozostałe platformy (OPCJONALNE) ------
      # Zaloguj się raz ręcznie przez noVNC (http://IP:6080) — sesja jest zapisywana.
      # Lub ustaw dane tutaj dla w pełni automatycznego logowania:
      # - EMAIL=twoj@email.com        # wspólne dla wszystkich platform
      # - PASSWORD=twoje_haslo
      # - EG_OTPKEY=                  # klucz 2FA Epic Games
      # - PG_OTPKEY=                  # klucz 2FA Prime Gaming
      # - STEAM_USERNAME=             # login Steam (nie email)
      # - STEAM_PASSWORD=

    healthcheck:
      test: curl --fail http://localhost:6080 || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3
```

> **Pierwszy build** trwa ~15 sekund — Portainer pobiera upstream image i nakłada pliki tego forka.

### Krok 3 — Pierwsze logowanie

Przy pierwszym uruchomieniu każda platforma wymaga ręcznego logowania:

1. Otwórz `http://TWOJE_IP:6080` — noVNC z przeglądarką Chromium
2. Zaloguj się w otwartych zakładkach lub wpisz dane w terminalu
3. Skrypt czeka `LOGIN_TIMEOUT` sekund (domyślnie 180s)

Sesja zapisuje się w wolumenie (`/mnt/data`) — kolejne uruchomienia są w pełni automatyczne.

---

## 💬 Powiadomienia Discord

| Embed | Kiedy |
|-------|-------|
| 🟢 **Container started** | Na początku każdego uruchomienia |
| ✅ **Games claimed** | Gdy platforma odbierze gry (per platforma) |
| ℹ️ **No new games** | Gdy platforma nie ma nic do odebrania |
| ❌ **Error + screenshot** | Gdy skrypt platformy zakończy się błędem |

> Jeśli `DISCORD_WEBHOOK` nie jest ustawiony — powiadomienia Discord są pomijane, Apprise działa normalnie.

---

## ⚙️ Zmienne środowiskowe

<details>
<summary><b>Ogólne</b></summary>

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `TZ` | `Europe/Warsaw` | Strefa czasowa kontenera |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `SHOW` | `1` | Pokaż przeglądarkę w VNC |
| `VNC_PASSWORD` | — | Hasło do noVNC na `:6080` |
| `EMAIL` | — | Wspólny email dla wszystkich platform |
| `PASSWORD` | — | Wspólne hasło dla wszystkich platform |

</details>

<details>
<summary><b>Discord</b></summary>

| Zmienna | Opis |
|---------|------|
| `DISCORD_WEBHOOK` | URL webhooka Discord (wymagany do powiadomień) |

</details>

<details>
<summary><b>Epic Games</b></summary>

| Zmienna | Opis |
|---------|------|
| `EG_EMAIL` | Email Epic Games (nadpisuje `EMAIL`) |
| `EG_PASSWORD` | Hasło Epic Games |
| `EG_OTPKEY` | Klucz 2FA — OTP generowany automatycznie |

</details>

<details>
<summary><b>Prime Gaming</b></summary>

| Zmienna | Opis |
|---------|------|
| `PG_EMAIL` | Email Prime Gaming (nadpisuje `EMAIL`) |
| `PG_PASSWORD` | Hasło Prime Gaming |
| `PG_OTPKEY` | Klucz 2FA — OTP generowany automatycznie |

</details>

<details>
<summary><b>GOG</b></summary>

| Zmienna | Opis |
|---------|------|
| `GOG_EMAIL` | Email GOG (nadpisuje `EMAIL`) |
| `GOG_PASSWORD` | Hasło GOG |

</details>

<details>
<summary><b>Steam</b></summary>

| Zmienna | Opis |
|---------|------|
| `STEAM_USERNAME` | Login Steam (nie email) |
| `STEAM_PASSWORD` | Hasło Steam |

</details>

<details>
<summary><b>AliExpress</b></summary>

| Zmienna | Opis |
|---------|------|
| `ALIEXPRESS_EMAIL` | Email AliExpress |
| `ALIEXPRESS_PASSWORD` | Hasło AliExpress |

</details>

Pełna lista opcji upstream: [`src/config.js`](https://github.com/p-adamiec/free-games-claimer/blob/enhanced/src/config.js)

---

## 🕐 Harmonogram — bez crona

```
deploy o 15:00   →  skrypty uruchamiają się od razu
                 →  sleep liczy: do jutro 07:00 = 16h
następny dzień 07:00  →  kontener budzi się → skrypty → sleep do następnego 07:00
i tak dalej...
```

`TZ=Europe/Warsaw` sprawia, że `date` liczy czas w polskiej strefie czasowej.

**Zmiana platform:**

```yaml
# Tylko Prime Gaming i GOG:
command: bash -c "node run.js prime-gaming gog; sleep ..."

# Wszystkie platformy:
command: bash -c "node run.js steam-games epic-games prime-gaming gog aliexpress; sleep ..."
```

Dostępne skrypty: `steam-games` · `epic-games` · `prime-gaming` · `gog` · `aliexpress`

---

## 🖥️ noVNC

Otwórz `http://TWOJE_IP:6080` w przeglądarce — Chromium działający wewnątrz kontenera. Przydatne przy pierwszym logowaniu i debugowaniu.

## 📋 Logi

```bash
docker logs free-games-claimer-dev -f
```

Lub Portainer → Containers → `free-games-claimer-dev` → Logs.

---

## 📝 Zmiany względem upstream

Zobacz [CHANGES.md](CHANGES.md).

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=7c3aed,06b6d4&height=100&section=footer" />
</div>
