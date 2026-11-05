import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './db.js';
import { JWT_SECRET, BOT_API_KEY } from './config.js';

// Constant-time string comparison (avoids leaking secrets via timing).
export function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Sentinel actor for the hidden owner account. It uses "@" which real
// usernames can never contain, so its activity is invisible everywhere:
// never written to security_logs (so also never mirrored to Discord web-logs),
// and it has no row in website_users.
export const GHOST_ACTOR = '@ghost';

// ---- JWT ----
export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Auth for the Discord bot. Uses a shared secret header (X-Bot-Key).
// The invoking Discord staff member is passed as the "actor" so security
// logs attribute the action to a real person, not just "the bot".
export function requireBotAuth(req, res, next) {
  const key = req.headers['x-bot-key'];
  if (!key || !timingSafeEqualStr(key, BOT_API_KEY)) return res.status(401).json({ error: 'Invalid bot key.' });
  const actor = req.headers['x-bot-actor'] || (req.body && req.body.actor) || 'Discord Bot';
  req.actor = String(actor).slice(0, 80);
  next();
}

// ---- Security logging ----
export function log({ actor, action, target = null, detail = null, level = 'info' }) {
  if (actor === GHOST_ACTOR) return; // hidden owner: never logged anywhere
  db.prepare(
    `INSERT INTO security_logs (actor, action, target, detail, level) VALUES (?, ?, ?, ?, ?)`
  ).run(actor, action, target, detail, level);
}

// ---- License key helpers ----
export const PLAN_DAYS = { month: 30, '3months': 90, year: 365, lifetime: null };
export const PLAN_LABELS = {
  month: 'Month',
  '3months': '3 Months',
  year: 'Year',
  lifetime: 'Lifetime',
};

export function planToExpiry(plan, fromDate = new Date()) {
  const days = PLAN_DAYS[plan];
  if (days == null) return null; // lifetime
  const d = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function generateKey() {
  const seg = () =>
    Array.from({ length: 5 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
  return `RAYX-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export function isExpired(key) {
  if (!key.expires_at) return false; // lifetime
  if (key.frozen) return false; // timer paused while frozen
  return new Date(key.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now();
}

// Milliseconds of access left. null = lifetime. While frozen we measure from
// the moment it was frozen, so the paused amount is what's shown.
export function remainingMs(key) {
  if (!key.expires_at) return null; // lifetime
  const end = new Date(key.expires_at.replace(' ', 'T') + 'Z').getTime();
  const from = key.frozen && key.frozen_at
    ? new Date(key.frozen_at.replace(' ', 'T') + 'Z').getTime()
    : Date.now();
  return end - from;
}

// "1 year, 2 months, 5 days" style English string (top 3 units).
export function humanizeDuration(ms) {
  if (ms == null) return 'Lifetime';
  if (ms <= 0) return 'Expired';
  let s = Math.floor(ms / 1000);
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

// Attach computed fields for the frontend.
export function decorateKey(key) {
  const frozen = !!key.frozen;
  const expired = isExpired(key);
  const rem = remainingMs(key);
  return {
    ...key,
    banned: !!key.banned,
    frozen,
    expired,
    plan_label: PLAN_LABELS[key.plan] || key.plan,
    status: key.banned ? 'banned' : frozen ? 'frozen' : expired ? 'expired' : 'active',
    remaining_ms: rem,
    remaining_human: frozen ? `${humanizeDuration(rem)} (paused)` : humanizeDuration(rem),
  };
}
