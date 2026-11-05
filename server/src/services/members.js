// Shared member (license) management logic.
// BOTH the website routes (server/src/routes/keys.js) and the Discord bot
// (server/src/routes/bot.js) call into here, so the freeze / time / ban rules
// live in exactly one place and can never drift apart.

import db from '../db.js';
import { log, planToExpiry, generateKey, decorateKey, PLAN_LABELS } from '../lib.js';
import { lookupDiscordUser } from '../discord.js';

export const VALID_PLANS = ['month', '3months', 'year', 'lifetime'];

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const toMs = (s) => new Date(s.replace(' ', 'T') + 'Z').getTime();

export const getRow = (id) => db.prepare('SELECT * FROM license_keys WHERE id = ?').get(id);

// A small typed error so route handlers can translate it into an HTTP status.
export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Resolve all membership rows for an identifier.
//  - 17-20 digit value  -> every membership belonging to that Discord ID
//  - anything else       -> the membership whose UUID matches
export function rowsForIdentifier(identifier) {
  const v = String(identifier || '').trim();
  if (!v) return [];
  if (/^\d{17,20}$/.test(v))
    return db.prepare('SELECT * FROM license_keys WHERE discord_id = ? ORDER BY created_at DESC').all(v);
  return db.prepare('SELECT * FROM license_keys WHERE uuid = ? ORDER BY created_at DESC').all(v);
}

// ---- Create a member (Discord ID + UUID + plan) ----
export async function addMember({ discordId, uuid, plan, actor }) {
  discordId = String(discordId || '').trim();
  uuid = String(uuid || '').trim();
  plan = String(plan || '').trim();

  if (!VALID_PLANS.includes(plan))
    throw httpError(400, 'Invalid plan. Choose month, 3months, year or lifetime.');
  if (!uuid) throw httpError(400, 'A UUID is required.');
  if (uuid.length > 128) throw httpError(400, 'UUID is too long (max 128).');

  // One membership per Discord user.
  if (db.prepare('SELECT id FROM license_keys WHERE discord_id = ?').get(discordId))
    throw httpError(409, 'This user already has a membership.');

  // Must be in the main server (only enforced once the bot has synced the list,
  // so the site still works before the bot has ever run).
  const inGuild = isInGuild(discordId);
  if (inGuild === false) throw httpError(400, 'This user is not in the main server.');

  const lookup = await lookupDiscordUser(discordId);
  if (!lookup.valid) throw httpError(400, 'That is not a valid Discord ID.');
  if (lookup.exists === false) throw httpError(404, 'No Discord account exists with that ID.');

  const expiresAt = planToExpiry(plan);
  const info = db
    .prepare(
      `INSERT INTO license_keys
        (key_value, discord_id, discord_username, discord_avatar, uuid, plan, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(generateKey(), discordId, lookup.username || null, lookup.avatar || null, uuid, plan, expiresAt, actor);

  log({
    actor,
    action: 'Member added',
    target: uuid,
    detail: `Discord ${lookup.username || discordId} · ${PLAN_LABELS[plan]}`,
    level: 'success',
  });

  const key = decorateKey(getRow(info.lastInsertRowid));
  enqueueWelcome(key); // bot DMs the user "you are now a member"
  return { key, lookup };
}

// Queue the welcome DM the bot will deliver (works for site- and bot-created).
function enqueueWelcome(key) {
  const data = JSON.stringify({
    plan: key.plan,
    plan_label: PLAN_LABELS[key.plan] || key.plan,
    uuid: key.uuid,
    expires_at: key.expires_at,
  });
  db.prepare('INSERT INTO notifications (discord_id, kind, data) VALUES (?, ?, ?)').run(key.discord_id, 'welcome', data);
}

// ---- Single-row operations (return the decorated, updated row) ----
export function banRow(row, actor, reason, { silent } = {}) {
  reason = reason ? String(reason).slice(0, 500) : null;
  db.prepare('UPDATE license_keys SET banned = 1, ban_reason = ? WHERE id = ?').run(reason, row.id);
  if (!silent) log({ actor, action: 'Member banned', target: row.uuid, detail: reason || null, level: 'danger' });
  return decorateKey(getRow(row.id));
}

export function unbanRow(row, actor, { silent } = {}) {
  db.prepare('UPDATE license_keys SET banned = 0, ban_reason = NULL WHERE id = ?').run(row.id);
  if (!silent) log({ actor, action: 'Member unbanned', target: row.uuid, level: 'success' });
  return decorateKey(getRow(row.id));
}

export function freezeRow(row, actor, { silent } = {}) {
  if (row.frozen) throw httpError(400, 'Already frozen.');
  db.prepare('UPDATE license_keys SET frozen = 1, frozen_at = ? WHERE id = ?').run(stamp(), row.id);
  if (!silent) log({ actor, action: 'Member frozen', target: row.uuid, level: 'warning' });
  return decorateKey(getRow(row.id));
}

export function unfreezeRow(row, actor, { silent } = {}) {
  if (!row.frozen) throw httpError(400, 'Not frozen.');
  // Push expiry forward by however long it was frozen (the timer was paused).
  let expires = row.expires_at;
  if (expires && row.frozen_at) {
    const paused = Date.now() - toMs(row.frozen_at);
    expires = new Date(toMs(expires) + Math.max(0, paused)).toISOString().slice(0, 19).replace('T', ' ');
  }
  db.prepare('UPDATE license_keys SET frozen = 0, frozen_at = NULL, expires_at = ? WHERE id = ?').run(expires, row.id);
  if (!silent) log({ actor, action: 'Member unfrozen', target: row.uuid, level: 'success' });
  return decorateKey(getRow(row.id));
}

export function addDaysRow(row, actor, days, { silent } = {}) {
  if (row.plan === 'lifetime') throw httpError(400, 'Lifetime members never expire.');
  days = parseInt(days, 10);
  if (!Number.isFinite(days) || days === 0) throw httpError(400, 'Enter a number of days.');
  // Extend from the later of now / current expiry so time is never lost.
  const base = Math.max(Date.now(), row.expires_at ? toMs(row.expires_at) : 0);
  const next = new Date(base + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE license_keys SET expires_at = ? WHERE id = ?').run(next, row.id);
  if (!silent)
    log({ actor, action: `Time ${days > 0 ? 'added' : 'removed'}`, target: row.uuid, detail: `${days} day(s)`, level: 'info' });
  return decorateKey(getRow(row.id));
}

export function changeUuidRow(row, actor, uuid) {
  uuid = String(uuid || '').trim();
  if (!uuid) throw httpError(400, 'UUID cannot be empty.');
  if (uuid.length > 128) throw httpError(400, 'UUID is too long (max 128).');
  db.prepare('UPDATE license_keys SET uuid = ? WHERE id = ?').run(uuid, row.id);
  log({ actor, action: 'UUID changed', target: uuid, detail: `was ${row.uuid || '—'}`, level: 'info' });
  return decorateKey(getRow(row.id));
}

export function removeRow(row, actor) {
  db.prepare('DELETE FROM license_keys WHERE id = ?').run(row.id);
  log({ actor, action: 'Member removed', target: row.uuid, level: 'danger' });
}

// ---- Bulk (Freeze All / Unfreeze All) ----
export function freezeAll(actor) {
  const rows = db.prepare('SELECT * FROM license_keys WHERE frozen = 0').all();
  const tx = db.transaction(() => rows.forEach((r) => freezeRow(r, actor, { silent: true })));
  tx();
  log({ actor, action: 'All members frozen', detail: `${rows.length} member(s)`, level: 'warning' });
  return rows.length;
}

export function unfreezeAll(actor) {
  const rows = db.prepare('SELECT * FROM license_keys WHERE frozen = 1').all();
  const tx = db.transaction(() => rows.forEach((r) => unfreezeRow(r, actor, { silent: true })));
  tx();
  log({ actor, action: 'All members unfrozen', detail: `${rows.length} member(s)`, level: 'success' });
  return rows.length;
}

export function addDaysAll(actor, days) {
  days = parseInt(days, 10);
  if (!Number.isFinite(days) || days === 0) throw httpError(400, 'Enter a number of days.');
  const rows = db.prepare("SELECT * FROM license_keys WHERE plan != 'lifetime'").all();
  const tx = db.transaction(() => rows.forEach((r) => addDaysRow(r, actor, days, { silent: true })));
  tx();
  log({
    actor,
    action: `Time ${days > 0 ? 'added' : 'removed'} (all)`,
    detail: `${days} day(s) × ${rows.length} member(s)`,
    level: 'info',
  });
  return rows.length;
}

// ---- Stats ----
export function counts() {
  const members = db.prepare('SELECT COUNT(*) AS c FROM license_keys').get().c;
  const users = db.prepare('SELECT COUNT(DISTINCT discord_id) AS c FROM license_keys').get().c;
  return { members, users };
}

// ---- Single member lookup (for /search) ----
export function memberByDiscordId(id) {
  const row = db.prepare('SELECT * FROM license_keys WHERE discord_id = ? ORDER BY created_at DESC').get(String(id));
  return row ? decorateKey(row) : null;
}

// ---- Main-server membership sync (kept fresh by the bot) ----
export function setGuildMembers(ids) {
  const clean = [...new Set((ids || []).map((x) => String(x).trim()).filter((x) => /^\d{17,20}$/.test(x)))];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM guild_members').run();
    const ins = db.prepare('INSERT OR IGNORE INTO guild_members (discord_id) VALUES (?)');
    clean.forEach((id) => ins.run(id));
  });
  tx();
  return clean.length;
}
export function addGuildMember(id) {
  if (/^\d{17,20}$/.test(String(id))) db.prepare('INSERT OR IGNORE INTO guild_members (discord_id) VALUES (?)').run(String(id));
}
export function removeGuildMember(id) {
  db.prepare('DELETE FROM guild_members WHERE discord_id = ?').run(String(id));
}
// true / false / null (null = the bot has never synced, so we can't tell)
export function isInGuild(id) {
  const synced = db.prepare('SELECT COUNT(*) AS c FROM guild_members').get().c;
  if (!synced) return null;
  return !!db.prepare('SELECT 1 FROM guild_members WHERE discord_id = ?').get(String(id));
}

// ---- Outbox (welcome DMs, etc.) ----
export function pendingNotifications() {
  return db.prepare('SELECT * FROM notifications WHERE delivered = 0 ORDER BY id ASC LIMIT 25').all();
}
export function ackNotification(id) {
  db.prepare('UPDATE notifications SET delivered = 1 WHERE id = ?').run(id);
}
