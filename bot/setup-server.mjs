// One-shot / idempotent Discord setup for Rayx Acces.
//
// Creates the roles, categories, channels and permission overwrites the bot
// needs, posts the ticket panel and the info embeds, then writes every created
// ID back into bot/config.json (and the auto-role into bot/data/state.json).
//
// Safe to re-run: everything is looked up by name first, messages are posted
// once (detected by author + marker), nothing is ever deleted.
//
//   node bot/setup-server.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ticketPanel } from './src/tickets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'data', 'state.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const API = 'https://discord.com/api/v10';
const GUILD = config.mainGuildId;
const BOT_ID = config.clientId;
const HEADERS = {
  Authorization: `Bot ${config.token}`,
  'User-Agent': 'DiscordBot (https://github.com/discordjs/discord.js, 14.16.3)',
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + route, {
      method,
      headers: HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.status === 429) {
      const wait = ((json?.retry_after ?? 1) + 0.25) * 1000;
      console.log(`   rate limited, waiting ${Math.round(wait)} ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`);
    return json;
  }
  throw new Error(`rate limited repeatedly: ${method} ${route}`);
}

// ---- permission bits ----
const B = (n) => 1n << BigInt(n);
const P = {
  VIEW: B(10),
  SEND: B(11),
  MANAGE_CH: B(4),
  MANAGE_MSG: B(13),
  EMBED: B(14),
  ATTACH: B(15),
  HISTORY: B(16),
  REACT: B(6),
  APP_CMD: B(31),
};
const ALLOW = (...bits) => bits.reduce((a, b) => a | b, 0n).toString();
const NONE = '0';

const everyone = GUILD; // @everyone role id == guild id

function overwrite(id, allow, deny) {
  return { id, type: 0, allow, deny };
}

// Read-only for members, staff may post.
function publicCategory(staffRoleId) {
  return [
    overwrite(everyone, ALLOW(P.VIEW, P.HISTORY, P.REACT, P.APP_CMD), ALLOW(P.SEND)),
    overwrite(staffRoleId, ALLOW(P.VIEW, P.HISTORY, P.SEND, P.EMBED, P.ATTACH, P.MANAGE_MSG, P.REACT), NONE),
  ];
}

// Invisible to members, full access for staff (used by logs + ticket channels).
function privateCategory(staffRoleId) {
  return [
    overwrite(everyone, NONE, ALLOW(P.VIEW)),
    overwrite(
      staffRoleId,
      ALLOW(P.VIEW, P.HISTORY, P.SEND, P.EMBED, P.ATTACH, P.MANAGE_MSG, P.MANAGE_CH, P.REACT),
      NONE
    ),
  ];
}

const byName = (list, name, type) => list.find((x) => x.name === name && (type === undefined || x.type === type));

async function ensureRole(name, color, hoist = true, mentionable = true) {
  const roles = await api('GET', `/guilds/${GUILD}/roles`);
  const found = byName(roles, name);
  if (found) {
    console.log(`   role   ${name} (exists)`);
    return found;
  }
  const created = await api('POST', `/guilds/${GUILD}/roles`, { name, color, hoist, mentionable });
  console.log(`   role   ${name} (created)`);
  return created;
}

async function ensureChannel({ name, type, parentId, topic, overwrites }) {
  const channels = await api('GET', `/guilds/${GUILD}/channels`);
  const found = channels.find(
    (c) => c.name === name && c.type === type && (parentId === undefined || c.parent_id === parentId)
  );
  if (found) {
    console.log(`   channel ${type === 4 ? 'category' : '#' + name} (exists)`);
    return found;
  }
  const body = { name, type };
  if (parentId) body.parent_id = parentId;
  if (topic) body.topic = topic;
  if (overwrites) body.permission_overwrites = overwrites;
  const created = await api('POST', `/guilds/${GUILD}/channels`, body);
  console.log(`   channel ${type === 4 ? 'category' : '#' + name} (created)`);
  return created;
}

async function recentMessages(channelId, limit = 50) {
  return api('GET', `/channels/${channelId}/messages?limit=${limit}`);
}

async function sendOnce(channelId, payload, isSame) {
  const messages = await recentMessages(channelId);
  const existing = messages.find((m) => m.author?.id === BOT_ID && isSame(m));
  if (existing) {
    console.log(`   message already posted in <#${channelId}>`);
    return existing;
  }
  const sent = await api('POST', `/channels/${channelId}/messages`, {
    ...payload,
    allowed_mentions: { parse: [] },
  });
  console.log(`   message posted in <#${channelId}>`);
  return sent;
}

const hasTitle = (title) => (m) => m.embeds?.[0]?.title === title;
const isPanel = (m) =>
  (m.components || []).some((row) => (row.components || []).some((c) => c.custom_id === 'ticket_open'));

async function main() {
  console.log(`\nRayx Acces - Discord setup for guild ${GUILD}\n`);

  const guild = await api('GET', `/guilds/${GUILD}`);
  console.log(`Server: ${guild.name}\nRoles:`);

  const staff = await ensureRole('Rayx Staff', 0xf5f5f5, true, true);
  const customer = await ensureRole('Rayx Customer', 0x57f287, true, true);
  const member = await ensureRole('Member', 0x9ca3af, false, false);

  console.log('\nCategories:');
  const info = await ensureChannel({ name: 'INFORMATION', type: 4 });
  const support = await ensureChannel({ name: 'SUPPORT', type: 4 });
  const access = await ensureChannel({ name: 'ACCESS', type: 4 });
  const logs = await ensureChannel({ name: 'LOGS', type: 4, overwrites: privateCategory(staff.id) });
  const openTickets = await ensureChannel({ name: 'TICKETS', type: 4, overwrites: privateCategory(staff.id) });
  const closedTickets = await ensureChannel({ name: 'CLOSED TICKETS', type: 4, overwrites: privateCategory(staff.id) });

  console.log('\nChannels:');
  const welcome = await ensureChannel({
    name: 'welcome',
    type: 0,
    parentId: info.id,
    overwrites: publicCategory(staff.id),
    topic: 'Start here - how to get access to Rayx Acces.',
  });
  const rules = await ensureChannel({
    name: 'rules',
    type: 0,
    parentId: info.id,
    overwrites: publicCategory(staff.id),
    topic: 'Server rules.',
  });
  const announcements = await ensureChannel({
    name: 'announcements',
    type: 0,
    parentId: info.id,
    overwrites: publicCategory(staff.id),
    topic: 'Rayx Acces announcements.',
  });
  const ticket = await ensureChannel({
    name: 'ticket',
    type: 0,
    parentId: support.id,
    overwrites: publicCategory(staff.id),
    topic: 'Open a private ticket with the button below.',
  });
  const changelogs = await ensureChannel({
    name: 'changelogs',
    type: 0,
    parentId: support.id,
    overwrites: publicCategory(staff.id),
    topic: 'Rayx Acces changelogs.',
  });
  const accessInfo = await ensureChannel({
    name: 'access',
    type: 0,
    parentId: access.id,
    overwrites: publicCategory(staff.id),
    topic: 'Plans, pricing and what we need to whitelist you.',
  });
  const webLogs = await ensureChannel({
    name: 'web-logs',
    type: 0,
    parentId: logs.id,
    overwrites: privateCategory(staff.id),
    topic: 'Website activity mirrored by the bot.',
  });
  const botLogs = await ensureChannel({
    name: 'bot-logs',
    type: 0,
    parentId: logs.id,
    overwrites: privateCategory(staff.id),
    topic: 'Every staff command used on the bot.',
  });
  const ticketLogs = await ensureChannel({
    name: 'ticket-logs',
    type: 0,
    parentId: logs.id,
    overwrites: privateCategory(staff.id),
    topic: 'Ticket opened / closed / deleted events.',
  });

  console.log('\nMessages:');
  const site = config.siteUrl || 'http://localhost:3001';

  await sendOnce(
    welcome.id,
    {
      embeds: [
        {
          title: 'Welcome to Rayx Acces',
          color: 0x5865f2,
          description:
            `**Rayx Acces** - licenses, HWID management and support in one place.\n\n` +
            `**Getting access**\n` +
            `1. Open a ticket in <#${ticket.id}>.\n` +
            `2. Tell us your **Discord ID** and your **HWID / UUID**.\n` +
            `3. Pick a plan and wait for the confirmation DM.\n\n` +
            `**Already a member?**\n` +
            `Log in to the panel: ${site}\n` +
            `Username + password + your 6-digit authenticator code.`,
          fields: [
            { name: 'Links', value: `[Panel](${site}) · [Support](<#${ticket.id}>) · [Changelogs](<#${changelogs.id}>)`, inline: false },
          ],
          footer: { text: 'Rayx Acces' },
        },
      ],
    },
    hasTitle('Welcome to Rayx Acces')
  );

  await sendOnce(
    rules.id,
    {
      embeds: [
        {
          title: 'Server Rules',
          color: 0x5865f2,
          description:
            '**1.** Never share your account, license or HWID with anyone.\n' +
            '**2.** No advertising, spam or unsolicited DMs to members.\n' +
            '**3.** Respect staff and their decisions.\n' +
            '**4.** Support happens in tickets only - not in public channels.\n' +
            '**5.** Attempting to bypass HWID locks or resell access ends the license immediately.',
          footer: { text: 'Rayx Acces' },
        },
      ],
    },
    hasTitle('Server Rules')
  );

  await sendOnce(
    accessInfo.id,
    {
      embeds: [
        {
          title: 'Plans & Access',
          color: 0x5865f2,
          description:
            '**Month** - 30 days\n' +
            '**3 Months** - 90 days\n' +
            '**Year** - 365 days\n' +
            '**Lifetime** - never expires\n\n' +
            `To get whitelisted open a ticket in <#${ticket.id}> with:\n` +
            '• your Discord ID\n' +
            '• your HWID / UUID\n' +
            '• the plan you want\n\n' +
            `Members can check their remaining time in the panel: ${site}`,
          fields: [
            { name: 'Links', value: `[Panel](${site}) · [Support](<#${ticket.id}>)`, inline: false },
          ],
          footer: { text: 'Rayx Acces' },
        },
      ],
    },
    hasTitle('Plans & Access')
  );

  await sendOnce(
    announcements.id,
    {
      embeds: [
        {
          title: 'Rayx Acces is live',
          color: 0x5865f2,
          description: `Panel: ${site}\nSupport: <#${ticket.id}>\nChangelogs: <#${changelogs.id}>`,
          fields: [
            { name: 'Links', value: `[Panel](${site}) · [Support](<#${ticket.id}>) · [Changelogs](<#${changelogs.id}>)`, inline: false },
          ],
          footer: { text: 'Rayx Acces' },
        },
      ],
    },
    hasTitle('Rayx Acces is live')
  );

  await sendOnce(
    changelogs.id,
    {
      embeds: [
        {
          title: 'Changelogs',
          color: 0x5865f2,
          description: 'New updates are posted here. Staff can also pull the latest list with `/changelogs`.',
          footer: { text: 'Rayx Acces' },
        },
      ],
    },
    hasTitle('Changelogs')
  );

  const panel = ticketPanel();
  await sendOnce(
    ticket.id,
    { embeds: panel.embeds.map((e) => e.toJSON()), components: panel.components.map((c) => c.toJSON()) },
    isPanel
  );

  // ---- persist ----
  config.staffRoleId = staff.id;
  config.categories = { openTickets: openTickets.id, closedTickets: closedTickets.id };
  config.channels = {
    webLogs: webLogs.id,
    botLogs: botLogs.id,
    ticketLogs: ticketLogs.id,
    ticketPanel: ticket.id,
    announcements: announcements.id,
    changelogs: changelogs.id,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    /* fresh */
  }
  state = { tickets: {}, byChannel: {}, lastLogId: null, ...state, autoroleId: member.id };
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');

  console.log('\nWritten to bot/config.json:');
  console.log(`   staffRoleId        ${staff.id}`);
  console.log(`   openTickets        ${openTickets.id}`);
  console.log(`   closedTickets      ${closedTickets.id}`);
  console.log(`   webLogs            ${webLogs.id}`);
  console.log(`   botLogs            ${botLogs.id}`);
  console.log(`   ticketLogs         ${ticketLogs.id}`);
  console.log(`   ticketPanel        ${ticket.id}`);
  console.log(`   auto-role          ${member.name} (${member.id})`);
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error('\nSetup failed:', e.message, '\n');
  process.exit(1);
});
