// Tiny JSON-file persistence for Discord-only state: open tickets and the
// id of the last security log we mirrored. Survives bot restarts.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// BOT_STATE_DIR lets a host mount a persistent disk for state.json
// (Render: mount a disk at /var/data, set BOT_STATE_DIR=/var/data).
const dir = process.env.BOT_STATE_DIR
  ? path.resolve(process.env.BOT_STATE_DIR)
  : path.join(__dirname, '..', 'data');
const file = path.join(dir, 'state.json');

let state = { tickets: {}, byChannel: {}, lastLogId: null, autoroleId: null };
if (existsSync(file)) {
  try {
    state = { tickets: {}, byChannel: {}, lastLogId: null, autoroleId: null, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    /* start fresh on corrupt file */
  }
}

function save() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2));
}

export const store = {
  getTicketByUser: (userId) => state.tickets[userId] || null,
  getUserByChannel: (channelId) => state.byChannel[channelId] || null,
  allTickets: () => Object.entries(state.tickets).map(([userId, t]) => ({ userId, ...t })),
  openTicket(userId, ticket) {
    state.tickets[userId] = ticket;
    state.byChannel[ticket.channelId] = userId;
    save();
  },
  closeTicket(userId) {
    const t = state.tickets[userId];
    if (t) delete state.byChannel[t.channelId];
    delete state.tickets[userId];
    save();
  },
  getLastLogId: () => state.lastLogId,
  setLastLogId(id) {
    state.lastLogId = id;
    save();
  },
  getAutorole: () => state.autoroleId,
  setAutorole(roleId) {
    state.autoroleId = roleId;
    save();
  },
};
