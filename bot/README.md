# Quantix Discord Bot

A clean, monochrome Discord bot for Quantix. It manages the whitelist,
runs a DM-based ticket system, and mirrors website activity into your log
server. It talks to the website over its **local API** (never a second copy
of the database), so freeze / time / ban rules always match the dashboard.

No emoji, English only, Anthropic-like polish.

---

## 1. Create the application & bot

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. Open **Bot** → **Add Bot**. Copy the **token** (this goes in `config.json`).
3. Under **Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**
   (to relay ticket messages) **and SERVER MEMBERS INTENT** (for the auto-role
   and the main-server membership sync). Both are required.
4. Open **OAuth2 → URL Generator**, scopes `bot` + `applications.commands`,
   and invite the bot to **both** servers (Main + Log/Ticket) with permissions:
   Manage Channels, Send Messages, Read Message History, Embed Links,
   Connect, and (for closing tickets) an Administrator role for your staff.

## 2. Fill in `config.json`

Copy `config.example.json` to `config.json` (already created for you) and set:

| Field | What it is |
| --- | --- |
| `token` | Your bot token from step 1 |
| `clientId` | The application ID (Developer Portal → General Information) |
| `mainGuildId` | The **Main** server ID |
| `ticketGuildId` | The **Log / Ticket** server ID |
| `staffRoleId` | Role required to use the bot's commands. When set, ONLY members with this role (or the server owner) may use commands — Administrator alone is not enough. Empty = require Administrator. On the ticket/log server, where this role does not exist, it falls back to Administrator. |
| `categories.openTickets` | Category ID where new ticket channels are created |
| `categories.closedTickets` | Category ID that closed tickets are moved to |
| `channels.webLogs` | Channel ID that mirrors the website's activity log |
| `channels.botLogs` | Channel ID that logs every command used |
| `api.baseUrl` | The website API URL (default `http://localhost:3001`) |
| `api.key` | Shared secret — **must equal** the server's `BOT_API_KEY` |
| `support.*` | Ticket panel title / description / color / button label |

> **Important:** `api.key` in this file and `BOT_API_KEY` on the website must be
> the same string. Set `BOT_API_KEY` in `server/.env` (see `server/.env.example`).
> To get channel/category IDs, enable Discord's Developer Mode, then right-click →
> Copy ID.

## 3. Run

The website (API) must be running first:

```bash
npm run dev        # from the repo root — starts the API + dashboard
npm run bot        # in another terminal — starts the bot
```

Or run all three together:

```bash
npm run dev:all    # API + dashboard + bot
```

Slash commands are registered to the Main guild automatically on startup
(guild commands appear instantly). You can also re-register manually:

```bash
npm run bot:deploy
```

---

## Commands (Main server, staff only)

| Command | Description |
| --- | --- |
| `/changelogs` | Show the latest website changelogs |
| `/keygen discordid uuid plan` | Add a member (Discord ID is verified as real). Plan: month / 3months / year / lifetime |
| `/banuser discordid [reason]` | Ban a member (identical to the site ban) |
| `/unban discordid-or-uuid` | Unban a member (accepts a Discord ID or a UUID) |
| `/freezeuser discordid` | Freeze a member (pauses the timer) |
| `/unfreezeuser discordid` | Unfreeze a member (resumes the timer) |
| `/addtime discordid days` | Add days to a member |
| `/removetime discordid days` | Remove days from a member |
| `/usercount` | Show how many members are registered |
| `/search discordid` | Look up whether a Discord ID has a membership (plan, UUID, status, time left, in-server) |
| `/autoroleon role` | Automatically give a role to everyone who joins the main server |
| `/autoroleoff` | Turn the auto-role off |
| `/autorolestatus` | Show the current auto-role setting |
| `/joinvc channel` | Join a voice channel, deafened (mic stays on) |
| `/leavevc` | Leave the voice channel |
| `/setticket` | Post the ticket panel in the current channel |
| `/clear [amount]` | Delete recent messages in the channel (default 100, max 100; needs Manage Messages) |

The bot shows an **idle** status with `discord.gg/quantix` as its activity at all times.

Rules enforced everywhere (site and bot): **one membership per Discord user**, and a
member must be **in the main server** to be granted access (the bot keeps that list
synced). When a membership is created — from the site or `/keygen` — the bot DMs the
user a welcome message with their plan and time remaining.

`/unban` accepts a Discord ID or a UUID; other actions target a Discord ID.

> **Auto-role note:** for `/autoroleon` to work, the bot needs the **Manage Roles**
> permission and its own highest role must sit **above** the role it hands out
> (Server Settings → Roles — drag the bot's role higher). `/autoroleon` checks this
> and tells you exactly what to fix if it can't assign the role. The **Server Members**
> intent must also be enabled.

## Tickets

- The panel (`/setticket`) has two buttons: **Create Ticket** and **Clear DM**.
- A user clicks **Create Ticket**. No channel is made on the Main server — instead
  the bot **DMs the user** and opens a channel in the **Open Tickets** category on
  the Log/Ticket server. A user can only have **one open ticket** at a time.
- The user talks to the bot in DMs; their messages appear in the ticket channel as
  `**username:** *message*` (their real name, so staff know who it is). Images too.
- Staff reply in the ticket channel; the user receives them in DMs as
  `**Staff:** *message*` — staff usernames are never revealed to the user. Staff see
  each other normally in the channel.
- Every relayed message is marked on the original with a check (delivered) or cross
  (failed to deliver) reaction, for both directions.
- **Clear DM** (on the panel) lets a user wipe the bot's messages from their own DM.
- **Close Ticket** (administrators only) moves the channel to **Closed Tickets** and
  notifies the user. If a ticket channel is **deleted** instead, the user is told it
  was deleted.

## Logs

- **web logs** channel mirrors the website's activity log (members added, bans,
  freezes, logins, etc.) in near real time.
- **bot logs** channel records every command that was used, by whom, and whether
  it succeeded.
- **ticket logs** channel records ticket lifecycle events (opened, closed, deleted).
