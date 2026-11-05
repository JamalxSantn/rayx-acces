// Endpoints consumed ONLY by the Discord bot (server/../bot).
// Protected by a shared secret (X-Bot-Key). Every write reuses the shared
// members service so the bot and the website behave identically.

import { Router } from 'express';
import db from '../db.js';
import { requireBotAuth, log } from '../lib.js';
import * as M from '../services/members.js';

const router = Router();
router.use(requireBotAuth);

const labelFor = (rows) => rows[0]?.discord_username || rows[0]?.discord_id || '—';

function resolveOr404(identifier) {
  const rows = M.rowsForIdentifier(identifier);
  if (!rows.length) throw M.httpError(404, 'No member found for that Discord ID or UUID.');
  return rows;
}

// ---- Read: latest changelogs ----
router.get('/changelogs', (req, res) => {
  const rows = db.prepare('SELECT * FROM changelogs ORDER BY id DESC LIMIT 15').all();
  res.json({ changelogs: rows });
});

// ---- Read: how many members / distinct Discord users ----
router.get('/count', (req, res) => {
  res.json(M.counts());
});

// ---- Search: does this Discord ID have a membership? ----
router.get('/member/:id', (req, res) => {
  res.json({ member: M.memberByDiscordId(req.params.id), inGuild: M.isInGuild(req.params.id) });
});

// ---- Main-server membership sync (full replace + incremental) ----
router.post('/guild-members', (req, res) => {
  const count = M.setGuildMembers(req.body.ids || []);
  res.json({ count });
});
router.post('/guild-members/add', (req, res) => {
  M.addGuildMember(req.body.id);
  res.json({ ok: true });
});
router.post('/guild-members/remove', (req, res) => {
  M.removeGuildMember(req.body.id);
  res.json({ ok: true });
});

// ---- Outbox: welcome DMs waiting to be delivered ----
router.get('/outbox', (req, res) => {
  res.json({ notifications: M.pendingNotifications() });
});
router.post('/outbox/:id/ack', (req, res) => {
  M.ackNotification(req.params.id);
  res.json({ ok: true });
});

// ---- Read: security logs after a given id (for the web-logs mirror) ----
router.get('/logs', (req, res) => {
  const after = Number(req.query.after || 0);
  const logs = db.prepare('SELECT * FROM security_logs WHERE id > ? ORDER BY id ASC LIMIT 50').all(after);
  const maxId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM security_logs').get().m;
  res.json({ logs, maxId });
});

// ---- Create a member ----
router.post('/members', async (req, res, next) => {
  try {
    const out = await M.addMember({
      discordId: req.body.discord_id,
      uuid: req.body.uuid,
      plan: req.body.plan,
      actor: req.actor,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// ---- Ban every membership of a Discord ID (or a single UUID) ----
router.post('/members/:id/ban', (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim() || null;
    const rows = resolveOr404(req.params.id);
    const members = rows.map((r) => M.banRow(r, req.actor, reason, { silent: true }));
    log({ actor: req.actor, action: 'Member banned', target: labelFor(rows), detail: reason, level: 'danger' });
    res.json({ count: members.length, members });
  } catch (e) {
    next(e);
  }
});

router.post('/members/:id/unban', (req, res, next) => {
  try {
    const rows = resolveOr404(req.params.id);
    const members = rows.map((r) => M.unbanRow(r, req.actor, { silent: true }));
    log({ actor: req.actor, action: 'Member unbanned', target: labelFor(rows), level: 'success' });
    res.json({ count: members.length, members });
  } catch (e) {
    next(e);
  }
});

router.post('/members/:id/freeze', (req, res, next) => {
  try {
    const all = resolveOr404(req.params.id);
    const rows = all.filter((r) => !r.frozen);
    if (!rows.length) throw M.httpError(400, 'This member is already frozen.');
    const members = rows.map((r) => M.freezeRow(r, req.actor, { silent: true }));
    log({ actor: req.actor, action: 'Member frozen', target: labelFor(all), level: 'warning' });
    res.json({ count: members.length, members });
  } catch (e) {
    next(e);
  }
});

router.post('/members/:id/unfreeze', (req, res, next) => {
  try {
    const all = resolveOr404(req.params.id);
    const rows = all.filter((r) => r.frozen);
    if (!rows.length) throw M.httpError(400, 'This member is not frozen.');
    const members = rows.map((r) => M.unfreezeRow(r, req.actor, { silent: true }));
    log({ actor: req.actor, action: 'Member unfrozen', target: labelFor(all), level: 'success' });
    res.json({ count: members.length, members });
  } catch (e) {
    next(e);
  }
});

// ---- Add / remove days (removetime just sends a negative number) ----
router.post('/members/:id/add-days', (req, res, next) => {
  try {
    const days = parseInt(req.body.days, 10);
    if (!Number.isFinite(days) || days === 0) throw M.httpError(400, 'Enter a number of days.');
    const all = resolveOr404(req.params.id);
    const rows = all.filter((r) => r.plan !== 'lifetime');
    if (!rows.length) throw M.httpError(400, 'This member is Lifetime and never expires.');
    const members = rows.map((r) => M.addDaysRow(r, req.actor, days, { silent: true }));
    log({
      actor: req.actor,
      action: `Time ${days > 0 ? 'added' : 'removed'}`,
      target: labelFor(all),
      detail: `${days} day(s)`,
      level: 'info',
    });
    res.json({ count: members.length, skippedLifetime: all.length - rows.length, members });
  } catch (e) {
    next(e);
  }
});

export default router;
