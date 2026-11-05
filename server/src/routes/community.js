import { Router } from 'express';
import db from '../db.js';
import { requireAuth, log } from '../lib.js';

const router = Router();
router.use(requireAuth);

const VALID_TAGS = ['update', 'feature', 'fix', 'announcement'];

// ---- Changelogs ----
router.get('/changelogs', (req, res) => {
  const { q = '', tag = 'all' } = req.query;
  let rows = db.prepare('SELECT * FROM changelogs ORDER BY id DESC').all();
  const term = String(q).toLowerCase().trim();
  if (term)
    rows = rows.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.body.toLowerCase().includes(term) ||
        c.author.toLowerCase().includes(term)
    );
  if (tag !== 'all') rows = rows.filter((c) => c.tag === tag);
  res.json({ changelogs: rows });
});

router.post('/changelogs', (req, res) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  const tag = VALID_TAGS.includes(req.body.tag) ? req.body.tag : 'update';
  if (!title || !body) return res.status(400).json({ error: 'Title and description are required.' });
  if (title.length > 200) return res.status(400).json({ error: 'Title is too long (max 200).' });
  if (body.length > 8000) return res.status(400).json({ error: 'Description is too long (max 8000).' });

  const info = db
    .prepare('INSERT INTO changelogs (author, title, body, tag) VALUES (?, ?, ?, ?)')
    .run(req.user.username, title, body, tag);
  log({ actor: req.user.username, action: 'Changelog posted', target: title, level: 'info' });
  res.json({ changelog: db.prepare('SELECT * FROM changelogs WHERE id = ?').get(info.lastInsertRowid) });
});

router.delete('/changelogs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM changelogs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  db.prepare('DELETE FROM changelogs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Staff chat ----
router.get('/chat', (req, res) => {
  const since = Number(req.query.since || 0);
  const rows = db
    .prepare('SELECT * FROM staff_chat WHERE id > ? ORDER BY id ASC LIMIT 200')
    .all(since);
  res.json({ messages: rows });
});

router.post('/chat', (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is empty.' });
  if (message.length > 1000) return res.status(400).json({ error: 'Message too long.' });
  const info = db
    .prepare('INSERT INTO staff_chat (user_id, username, message) VALUES (?, ?, ?)')
    .run(req.user.id, req.user.username, message);
  res.json({ message: db.prepare('SELECT * FROM staff_chat WHERE id = ?').get(info.lastInsertRowid) });
});

export default router;
