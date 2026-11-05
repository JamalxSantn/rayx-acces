// Poll the website's security logs and mirror new entries into the
// "web logs" channel on the ticket/log server.

import config from './config.js';
import * as api from './api.js';
import { store } from './store.js';
import { embed } from './ui.js';

const LEVEL_EMOJI = { success: '✅', warning: '⚠️', danger: '🔴', info: 'ℹ️' };

async function webLogsChannel(client) {
  if (!config.channels?.webLogs) return null;
  const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
  if (!guild) return null;
  return guild.channels.fetch(config.channels.webLogs).catch(() => null);
}

function logEmbed(l) {
  const icon = LEVEL_EMOJI[l.level] || 'ℹ️';
  const fields = [{ name: '👤 By', value: `**${l.actor || 'System'}**`, inline: true }];
  if (l.target) fields.push({ name: '🎯 Target', value: `\`${l.target}\``, inline: true });
  if (l.detail) fields.push({ name: '📄 Details', value: `*${l.detail}*` });
  return embed({ title: `${icon} ${l.action}`, fields, footer: `Website log · ${l.created_at}` });
}

export function startLogMirror(client) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      let after = store.getLastLogId();

      // First run: jump to the newest id so we don't replay all history.
      if (after == null) {
        const { maxId } = await api.getLogs(0);
        store.setLastLogId(maxId);
        return;
      }

      const { logs } = await api.getLogs(after);
      if (!logs.length) return;

      const channel = await webLogsChannel(client);
      if (!channel) {
        // Still advance the cursor so we don't spam once the channel exists.
        store.setLastLogId(logs[logs.length - 1].id);
        return;
      }

      for (const l of logs) {
        await channel.send({ embeds: [logEmbed(l)] }).catch(() => {});
        store.setLastLogId(l.id);
      }
    } catch {
      /* website may be briefly down; try again next tick */
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, 5000);
}
