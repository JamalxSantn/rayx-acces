// Keeps the website's copy of the main-server member list fresh, and delivers
// queued DMs (e.g. the "you are now a member" welcome) created by the site or
// the /keygen command.

import config from './config.js';
import * as api from './api.js';
import { store } from './store.js';
import { embed, remainingFrom, EMO } from './ui.js';

// Clear tickets whose channels no longer exist (e.g. deleted while offline).
export async function pruneStaleTickets(client) {
  try {
    const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
    if (!guild) return;
    let cleared = 0;
    for (const t of store.allTickets()) {
      const channel = await guild.channels.fetch(t.channelId).catch(() => null);
      if (!channel) {
        store.closeTicket(t.userId);
        cleared++;
      }
    }
    if (cleared) console.log(`[Rayx Acces] Cleared ${cleared} stale ticket(s) with missing channels.`);
  } catch (e) {
    console.error('[Rayx Acces] Ticket prune failed:', e.message);
  }
}

// Push the full main-server member list to the website.
export async function syncGuildMembers(client) {
  try {
    const guild = await client.guilds.fetch(config.mainGuildId).catch(() => null);
    if (!guild) return;
    const members = await guild.members.fetch(); // requires the Server Members intent
    const ids = [...members.keys()];
    const { count } = await api.syncGuildMembers(ids);
    console.log(`[Rayx Acces] Synced ${count} main-server members to the website.`);
  } catch (e) {
    console.error('[Rayx Acces] Guild member sync failed:', e.message);
  }
}

async function deliver(client, note) {
  let data = {};
  try {
    data = JSON.parse(note.data || '{}');
  } catch {
    /* keep empty */
  }
  const user = await client.users.fetch(note.discord_id).catch(() => null);
  if (!user) return true; // unknown user: drop it (still ack)

  if (note.kind === 'welcome') {
    await user
      .send({
        embeds: [
          embed({
            title: `${EMO.welcome} Membership Activated`,
            description:
              'You are now an **official member** — welcome aboard! Thank you for choosing us. Here are your membership details:',
            fields: [
              { name: `${EMO.plan} Plan`, value: `**${data.plan_label || data.plan || '—'}**`, inline: true },
              { name: `${EMO.clock} Time Remaining`, value: `**${remainingFrom(data.expires_at)}**`, inline: true },
            ],
            footer: 'Rayx Acces · Membership',
          }),
        ],
      })
      .catch(() => {}); // DMs closed: nothing we can do, still ack below
  }
  return true;
}

// Poll the website's outbox and deliver pending DMs.
export function startOutboxPoller(client) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const notes = await api.getOutbox();
      for (const n of notes) {
        const done = await deliver(client, n);
        if (done) await api.ackOutbox(n.id);
      }
    } catch {
      /* website may be briefly down; retry next tick */
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, 5000);
}
