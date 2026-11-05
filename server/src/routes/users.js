import { Router } from 'express';
import db from '../db.js';
import { requireAuth, decorateKey } from '../lib.js';
import { lookupDiscordUser } from '../discord.js';

const router = Router();
router.use(requireAuth);

// Aggregate license holders into "users" (one row per Discord ID).
function buildUsers() {
  const keys = db.prepare('SELECT * FROM license_keys ORDER BY created_at DESC').all().map(decorateKey);
  const map = new Map();
  for (const k of keys) {
    if (!map.has(k.discord_id)) {
      map.set(k.discord_id, {
        discord_id: k.discord_id,
        discord_username: k.discord_username,
        discord_avatar: k.discord_avatar,
        keys: [],
        first_seen: k.created_at,
      });
    }
    const u = map.get(k.discord_id);
    u.keys.push(k);
    if (k.discord_username && !u.discord_username) u.discord_username = k.discord_username;
    if (k.discord_avatar && !u.discord_avatar) u.discord_avatar = k.discord_avatar;
  }
  return [...map.values()].map((u) => ({
    ...u,
    key_count: u.keys.length,
    banned: u.keys.some((k) => k.banned),
    frozen: u.keys.some((k) => k.frozen),
    has_active: u.keys.some((k) => k.status === 'active'),
    uuids: u.keys.map((k) => k.uuid).filter(Boolean),
    latest_uuid: u.keys[0]?.uuid,
    latest_created: u.keys[0]?.created_at,
    latest_plan_label: u.keys[0]?.plan_label,
    latest_expires: u.keys[0]?.expires_at,
    latest_status: u.keys[0]?.status,
  }));
}

// ---- List users (search + filter) ----
router.get('/', (req, res) => {
  const { q = '', banned = 'all', active = 'all' } = req.query;
  let users = buildUsers();
  const term = String(q).toLowerCase().trim();
  if (term)
    users = users.filter(
      (u) => u.discord_id.includes(term) || (u.discord_username || '').toLowerCase().includes(term)
    );
  if (banned !== 'all') users = users.filter((u) => u.banned === (banned === 'true'));
  if (active !== 'all') users = users.filter((u) => u.has_active === (active === 'true'));
  res.json({ users });
});

// ---- Single user detail (refreshes Discord info live) ----
router.get('/:discordId', async (req, res) => {
  const users = buildUsers();
  const user = users.find((u) => u.discord_id === req.params.discordId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const lookup = await lookupDiscordUser(req.params.discordId);
  if (lookup.exists && lookup.username) {
    user.discord_username = lookup.username;
    user.discord_avatar = lookup.avatar;
    // Backfill cached info onto the keys table.
    db.prepare('UPDATE license_keys SET discord_username = ?, discord_avatar = ? WHERE discord_id = ?').run(
      lookup.username,
      lookup.avatar,
      req.params.discordId
    );
  }
  res.json({ user, lookup });
});

export default router;
