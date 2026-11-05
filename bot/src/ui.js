import { EmbedBuilder } from 'discord.js';

// Monochrome, Anthropic-like near-white accent bar.
export const BRAND = 0xf5f5f5;

// A tasteful, consistent emoji set used across the bot's messages.
export const EMO = {
  added: '🎉',
  welcome: '🎉',
  ban: '🔨',
  unban: '♻️',
  freeze: '❄️',
  unfreeze: '▶️',
  addTime: '⏫',
  removeTime: '⏬',
  search: '🔍',
  count: '👥',
  voice: '🔊',
  leave: '👋',
  ticket: '🎫',
  opened: '📩',
  closed: '🔒',
  deleted: '🗑️',
  autorole: '🎭',
  error: '⚠️',
  changelog: '📝',
  info: 'ℹ️',
  clock: '⏳',
  plan: '📦',
  uuid: '🔑',
  user: '👤',
  command: '⚡',
  panel: '💬',
  success: '✅',
  staff: '🛡️',
  chat: '💬',
};

export function trunc(value, n = 1024) {
  const s = String(value ?? '').trim();
  if (!s) return '—';
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

// Human remaining time from a stored "YYYY-MM-DD HH:MM:SS" (UTC) expiry.
// null expiry = Lifetime. Matches the website's wording.
export function remainingFrom(expiresAt) {
  if (!expiresAt) return 'Lifetime';
  const end = new Date(expiresAt.replace(' ', 'T') + 'Z').getTime();
  let s = Math.floor((end - Date.now()) / 1000);
  if (s <= 0) return 'Expired';
  const units = [
    ['year', 365 * 86400],
    ['month', 30 * 86400],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const parts = [];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      s -= n * secs;
      parts.push(`${n} ${name}${n !== 1 ? 's' : ''}`);
    }
    if (parts.length === 3) break;
  }
  return parts.length ? parts.join(', ') : 'less than a minute';
}

// Build a clean embed. `fields` entries are auto-trimmed and never empty.
export function embed({ title, description, fields, footer, thumbnail, color = BRAND }) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(trunc(title, 256));
  if (description) e.setDescription(trunc(description, 4096));
  if (Array.isArray(fields) && fields.length)
    e.addFields(
      fields
        .filter(Boolean)
        .map((f) => ({ name: trunc(f.name, 256), value: trunc(f.value, 1024), inline: !!f.inline }))
    );
  if (footer) e.setFooter({ text: trunc(footer, 2048) });
  if (thumbnail) e.setThumbnail(thumbnail);
  return e;
}
