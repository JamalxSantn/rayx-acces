import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(__dirname, '..', 'config.json');

// config.json is optional: locally it holds everything, on a host (e.g. Render)
// the values come from environment variables instead and the file is not
// deployed. File values are the defaults, env vars always win.
let file = {};
if (existsSync(cfgPath)) {
  try {
    file = JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    console.error(`\n[Rayx Acces] Could not parse config.json at:\n  ${cfgPath}\n  ${e.message}\n`);
    process.exit(1);
  }
}

const env = process.env;
// First non-empty env var from the list, else the file value.
const pick = (names, fallback = '') => {
  for (const name of names) {
    const v = env[name];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
};

// Render hands out a bare host ("rayx-acces.onrender.com"); GitHub/local tests
// use a full URL. Normalise to an absolute https URL, drop a trailing slash.
const url = (value, fallback) => {
  const v = String(value || fallback || '').trim();
  if (!v) return '';
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.replace(/\/+$/, '');
};

const config = {
  ...file,
  token: pick(['BOT_TOKEN', 'DISCORD_TOKEN'], file.token),
  clientId: pick(['CLIENT_ID', 'DISCORD_CLIENT_ID'], file.clientId),
  mainGuildId: pick(['MAIN_GUILD_ID', 'GUILD_ID'], file.mainGuildId),
  ticketGuildId: pick(['TICKET_GUILD_ID'], file.ticketGuildId || file.mainGuildId),
  staffRoleId: pick(['STAFF_ROLE_ID'], file.staffRoleId || ''),
  categories: {
    openTickets: pick(['OPEN_TICKETS_CATEGORY_ID'], file.categories?.openTickets || ''),
    closedTickets: pick(['CLOSED_TICKETS_CATEGORY_ID'], file.categories?.closedTickets || ''),
  },
  channels: {
    ...(file.channels || {}),
    webLogs: pick(['WEB_LOGS_CHANNEL_ID'], file.channels?.webLogs || ''),
    botLogs: pick(['BOT_LOGS_CHANNEL_ID'], file.channels?.botLogs || ''),
    ticketLogs: pick(['TICKET_LOGS_CHANNEL_ID'], file.channels?.ticketLogs || ''),
    ticketPanel: pick(['TICKET_PANEL_CHANNEL_ID'], file.channels?.ticketPanel || ''),
    announcements: pick(['ANNOUNCEMENTS_CHANNEL_ID'], file.channels?.announcements || ''),
    changelogs: pick(['CHANGELOGS_CHANNEL_ID'], file.channels?.changelogs || ''),
  },
  api: (() => {
    // Single-service mode (free Render plan): the bot runs inside the web
    // service, so talk to the API over loopback instead of the public URL.
    const port = env.PORT || '3001';
    const internal = /^(1|true|yes|on)$/i.test(String(env.API_INTERNAL || ''));
    const renderUrl = (env.RENDER_EXTERNAL_URL || '').trim();
    const fallback = internal || !renderUrl ? `http://127.0.0.1:${port}` : renderUrl;
    return {
      baseUrl: url(pick(['API_BASE_URL', 'API_URL'], file.api?.baseUrl || fallback)),
      key: pick(['BOT_API_KEY'], file.api?.key || ''),
    };
  })(),
  siteUrl: url(
    pick(['SITE_URL', 'PUBLIC_URL'], file.siteUrl || env.RENDER_EXTERNAL_URL || ''),
    pick(['API_BASE_URL', 'API_URL'], file.api?.baseUrl)
  ),
  support: { ...(file.support || {}) },
};

if (!config.token || config.token === 'YOUR_DISCORD_BOT_TOKEN') {
  console.error('\n[Rayx Acces] No bot token. Set BOT_TOKEN in the environment');
  console.error('             (or fill "token" in bot/config.json).\n');
  process.exit(1);
}
if (!config.clientId || !config.mainGuildId) {
  console.error('\n[Rayx Acces] Missing CLIENT_ID or MAIN_GUILD_ID in the environment.\n');
  process.exit(1);
}
if (!config.api.key) {
  console.warn('[Rayx Acces] BOT_API_KEY is empty - the website will reject every bot call.');
}

export default config;
