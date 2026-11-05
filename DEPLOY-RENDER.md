# Rayx Acces auf Render — Free Plan (ein Service)

Free Plan, ein einziger Web Service, alles drin:

| Was | Wie |
|---|---|
| Panel (React-Build) | `client/dist`, vom API-Server ausgeliefert |
| API (`/api/...`) | Node/Express auf `$PORT` |
| Discord-Bot | gleicher Prozess, gestartet über `npm run start:free` |

Free hat **keine Background Worker** und **keine Disks** — deshalb läuft der Bot
im Web Service mit und redet über `127.0.0.1` mit der API (`API_INTERNAL=true`).

Der Starter-Aufbau (2 Services + 1 GB Disk, Daten bleiben erhalten) liegt
daneben in `render-starter.yaml`. Wenn du den willst: Inhalt nach `render.yaml`
kopieren, ~14,50 $/Monat.

---

## 0. Voraussetzungen

- Repo auf GitHub (privat reicht).
- Render-Account: <https://dashboard.render.com>

Repo einmal hochschieben:

```bash
cd "C:\Users\Jamal\Desktop\quantix\quantix\Mxstafa Auth"
git remote add origin https://github.com/<DEIN-USER>/<DEIN-REPO>.git
git push -u origin main
```

`.gitignore` hält `server/.env`, `bot/config.json`, `server/data/`,
`bot/data/`, `client/dist/` und `node_modules/` draußen. **Keine Secrets im
Repo** — alles Sensible ist Env Var in Render.

---

## 1. Service anlegen (Blueprint)

1. Dashboard → **New +** → **Blueprint**.
2. GitHub-Repo verbinden, Branch `main`.
3. Render liest `render.yaml`: ein Service `rayx-acces`, Plan **Free** → **Apply**.

Manuell geht auch: **New +** → **Web Service**, dann

- Build: `npm ci --include=dev && npm run build`
- Start: `npm run start:free`
- Health Check: `/api/health`
- Plan: Free, Region: Frankfurt

---

## 2. Secrets eintragen

Beim Blueprint-Deploy fragt Render alles mit `sync: false` ab. Nur zwei Werte:

| Key | Wert |
|---|---|
| `BOT_TOKEN` | Discord-Bot-Token (das aus deiner lokalen `bot/config.json`) |
| `SECRET_PHRASE` | dein verstecktes Owner-Passwort fürs Login-Formular |

`JWT_SECRET` und `BOT_API_KEY` erzeugt Render selbst (`generateValue: true`).
Weil API und Bot denselben Env-Block teilen, muss `BOT_API_KEY` nirgends
kopiert werden — das war im 2-Service-Aufbau die häufigste Fehlerquelle.

Guild-, Rollen-, Kategorie- und Channel-IDs stehen fertig in `render.yaml`.
`SITE_URL` / API-URL liest der Code aus `RENDER_EXTERNAL_URL`, das Render
automatisch setzt.

---

## 3. Erster Boot

1. **Logs** öffnen. Die leere DB legt einen Bootstrap-Registrierungsschlüssel an:

   ```
   Rayx Acces - bootstrap registration key
   RAYX-REG-XXXXX-XXXXX
   ```

2. `https://<service>.onrender.com` → **Register** → Key einsetzen,
   Username/Passwort wählen, Authenticator einrichten → Admin fertig.

3. Im gleichen Log sollte stehen:

   ```
   [BOT] [Rayx Acces] Logged in as Rayx acces w#7434
   [BOT] [Rayx Acces] Registered 17 slash commands to the main guild.
   [BOT] [Rayx Acces] Synced N main-server members to the website.
   ```

4. Ticket über das Panel in `#ticket` aufmachen — Bot und API sind dann
   nachweislich verbunden.

---

## 4. Keep-Alive (Pflicht auf Free)

Free schläft nach ~15 Minuten ohne eingehenden Traffic ein. Beim Aufwachen
startet der Container **leer** — SQLite und `bot/data/state.json` sind weg,
also Admin-Account, Keys, Member und offene Tickets.

Gegen das Einschlafen: alle 5–10 Minuten ein Ping auf

```
https://<service>.onrender.com/api/health
```

- **cron-job.org** (kostenlos): Job, URL oben, Intervall 5 min.
- oder **UptimeRobot**: HTTP(s)-Monitor, 5 min.

Der Health-Check antwortet mit `{"ok":true,"service":"Rayx Acces",...}`.
Damit bleibt die Instanz wach und die Daten halten, solange nicht deployt
oder neu gestartet wird — Deploys, Crashes und "Manual Deploy" wischen
weiterhin.

**Wirklich dauerhaft** wird es nur mit Persistenz:

- `render-starter.yaml` (Disk, ~14,50 $/Monat), oder
- Umbau von SQLite auf Render Postgres (Free-Postgres läuft nach 30 Tagen ab,
  danach kostet die kleinste Instanz Geld).

---

## 5. Lokal bleibt alles wie es war

`server/.env` und `bot/config.json` sind lokal und werden nicht deployt. Der
Code liest erst Env Vars, fällt dann auf die Dateien zurück. Lokal also
weiter:

```bash
npm run dev        # API + Panel
npm run dev:all    # API + Panel + Bot
```

Test des Free-Aufbaus ohne Render (eigener Port, eigene Datenordner):

```powershell
$env:PORT="3998"; $env:DATA_DIR="$env:TEMP\rayx\db"; $env:BOT_STATE_DIR="$env:TEMP\rayx\bot"; $env:API_INTERNAL="1"
npm run start:free
```

---

## 6. Updates

`autoDeploy: true` → jeder `git push origin main` baut und deployt neu.
Auf Free heißt das: Daten sind danach frisch (neuer Bootstrap-Key im Log).

---

## Gotchas

- `npm ci` braucht die committete `package-lock.json` — ist drin.
- Node ist auf `20.19.0` gepinnt (`better-sqlite3`-Prebuilds passen dazu).
- Free-Instanzen haben 512 MB RAM. Panel-Build läuft während des Builds, nicht
  zur Laufzeit — das passt.
- Bot und API sterben zusammen (`--kill-others`): stirbt der Bot, startet
  Render den ganzen Service neu. Gewollt, sonst läuft eine halbe Instanz.
- `Cannot reach the Rayx Acces API` im Bot-Log → `API_INTERNAL` fehlt oder der
  API-Teil ist noch nicht oben.
- Andere `BOT_API_KEY` später setzen heißt: Env Var ändern, Service neu starten.
- Eigene Domain: im Service eintragen, dann `SITE_URL` explizit setzen —
  sonst zeigen Embeds weiter auf `*.onrender.com`.
