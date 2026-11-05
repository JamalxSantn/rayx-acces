import { Router } from 'express';
import db from '../db.js';
import { requireAuth, decorateKey } from '../lib.js';
import { lookupDiscordUser } from '../discord.js';
import * as M from '../services/members.js';

const router = Router();
router.use(requireAuth);

// ---- Validate a Discord ID (real account?) without creating anything ----
router.get('/lookup/:id', async (req, res) => {
  const lookup = await lookupDiscordUser(req.params.id);
  res.json({ lookup });
});

// ---- Add a member (Discord ID + UUID + plan) ----
router.post('/', async (req, res, next) => {
  try {
    const out = await M.addMember({
      discordId: req.body.discord_id,
      uuid: req.body.uuid,
      plan: req.body.plan,
      actor: req.user.username,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// ---- List members (search + filter) ----
router.get('/', (req, res) => {
  const { q = '', status = 'all', plan = 'all', banned = 'all' } = req.query;
  let rows = db.prepare('SELECT * FROM license_keys ORDER BY created_at DESC').all().map(decorateKey);
  const term = String(q).toLowerCase().trim();
  if (term)
    rows = rows.filter(
      (k) =>
        (k.uuid || '').toLowerCase().includes(term) ||
        k.discord_id.includes(term) ||
        (k.discord_username || '').toLowerCase().includes(term)
    );
  if (status !== 'all') rows = rows.filter((k) => k.status === status);
  if (plan !== 'all') rows = rows.filter((k) => k.plan === plan);
  if (banned !== 'all') rows = rows.filter((k) => k.banned === (banned === 'true'));
  res.json({ keys: rows });
});

// ---- Bulk: Freeze All / Unfreeze All (declared before /:id routes) ----
router.post('/freeze-all', (req, res) => {
  const count = M.freezeAll(req.user.username);
  res.json({ count });
});

router.post('/unfreeze-all', (req, res) => {
  const count = M.unfreezeAll(req.user.username);
  res.json({ count });
});

// Add (positive) or remove (negative) days for every non-lifetime member.
router.post('/add-days-all', (req, res, next) => {
  try {
    const count = M.addDaysAll(req.user.username, req.body.days);
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

// ---- Per-member actions ----
function rowOr404(req, res) {
  const row = M.getRow(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Member not found.' });
    return null;
  }
  return row;
}

router.post('/:id/ban', (req, res) => {
  const row = rowOr404(req, res);
  if (!row) return;
  const reason = String(req.body.reason || '').trim() || null;
  res.json({ key: M.banRow(row, req.user.username, reason) });
});

router.post('/:id/unban', (req, res) => {
  const row = rowOr404(req, res);
  if (!row) return;
  res.json({ key: M.unbanRow(row, req.user.username) });
});

router.post('/:id/freeze', (req, res, next) => {
  try {
    const row = rowOr404(req, res);
    if (!row) return;
    res.json({ key: M.freezeRow(row, req.user.username) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/unfreeze', (req, res, next) => {
  try {
    const row = rowOr404(req, res);
    if (!row) return;
    res.json({ key: M.unfreezeRow(row, req.user.username) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/add-days', (req, res, next) => {
  try {
    const row = rowOr404(req, res);
    if (!row) return;
    res.json({ key: M.addDaysRow(row, req.user.username, req.body.days) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/uuid', (req, res, next) => {
  try {
    const row = rowOr404(req, res);
    if (!row) return;
    res.json({ key: M.changeUuidRow(row, req.user.username, req.body.uuid) });
  } catch (e) {
    next(e);
  }
});

// ---- Remove a member ----
router.delete('/:id', (req, res) => {
  const row = rowOr404(req, res);
  if (!row) return;
  M.removeRow(row, req.user.username);
  res.json({ ok: true });
});

export default router;
