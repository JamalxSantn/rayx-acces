# Quantix

A modern, black & white, fully-animated authentication & license-management dashboard.
Built with **Node + Express + SQLite** (backend) and **React + Vite + Tailwind + Framer Motion** (frontend).

## Features

- **Auth**: Register (username / password / confirm) → mandatory **Google Authenticator (TOTP 2FA)** setup → Login (username / password) → 2FA code → dashboard.
- **Overview → Dashboard**: live statistics (keys, users, active/expired/banned, plans breakdown, charts).
- **Community → ChangeLogs**: every logged-in staff member can post changelogs.
- **Community → Staff Chat**: shared live chat for all accounts.
- **Management → Users**: every member, real Discord avatar + username (pulled from Discord ID), UUID(s), plan, dates, status. Click a user to **manage** them: Ban / Unban (with reason), Freeze / Unfreeze (pauses the timer), add days to the duration (except Lifetime), or change their UUID. Header buttons **Freeze all / Unfreeze all** (with a confirmation) pause or resume every member's timer at once.
- **Management → License Key**: grant a user access by **Discord ID + UUID + plan** (`month / 3 months / year / lifetime`). The Discord ID is validated as a *real* account — no license strings, it's a site-side whitelist the game server can validate later.
- **Management → ScreenShots**: gallery (with one example) → click for holder detail.
- **Security**: full site activity log (who added a member, logged in, banned/froze someone, etc.).
- **Admin → Website Users**: the site's admin accounts.
- **Search + very detailed filtering** on every list (banned/not, expired/not, plan, date, text search…).

## Discord data (no bot required for the website)

Discord avatars, usernames and **real-ID validation** are fetched from the public
[`japi.rest`](https://japi.rest) lookup API — the dashboard needs no bot token.

## Discord bot (optional)

An optional Discord bot lives in [`bot/`](bot/README.md). It manages the whitelist
from Discord, runs a DM-based ticket system across a Main + Log/Ticket server pair,
and mirrors website activity into your log channels. It talks to this website over
its **local API** (a shared `BOT_API_KEY`), so freeze / time / ban behaviour is
always identical to the dashboard.

```bash
npm run bot        # start the bot (website must be running)
npm run dev:all    # website + bot together
```

See **[bot/README.md](bot/README.md)** for the full setup (tokens, intents, channel
IDs, commands, and how tickets work).

## Requirements

- Node.js 18+ (tested on Node 20)

## Setup & Run

```bash
# 1. install everything (root + server + client via npm workspaces)
npm install

# 2. run backend + frontend together (dev)
npm run dev
```

Then open the URL Vite prints (default **http://localhost:5173**).
The backend runs on **http://localhost:3001**.

### Production build

```bash
npm run build      # builds the React client into client/dist
npm start          # Express serves the API + the built client on :3001
```

## Registration keys (createkey.py)

Creating a website (admin) account **requires a single-use registration key**.
On the very first `npm run dev`, the server prints a **bootstrap key** in the console.
Generate more anytime with the included Python tool (no dependencies, Python 3):

Just **double-click `createkey.py`** (or run `python createkey.py`): it creates an
access key, prints it, and keeps the window open — press **ENTER** for another key,
or close the window when done.

```
Access Key [2026-07-04]
> QUANTIX-REG-F3A7Y-37YJ7
```

```bash
python createkey.py list                       # list all keys + status
python createkey.py revoke QUANTIX-REG-XXXXX-XXXXX   # delete an unused key
```

`createkey.py` writes straight to the same SQLite database, so it works whether or
not the server is running. Registration keys are only needed to **create** an
account — logging in just needs username + password + your 2FA code.

## First use

1. Run `npm run dev` and copy the **bootstrap registration key** from the server console
   (or run `python createkey.py` to make one).
2. Open the app → **Register** → paste the registration key, choose a username & password.
3. Scan the QR with **Google Authenticator** (or any TOTP app) and enter the 6-digit code to finish setup.
4. **Log in** with username + password, then your current 6-digit code.
5. You're in the dashboard.

## Config

Copy `server/.env.example` to `server/.env` to override defaults (port, JWT secret).
