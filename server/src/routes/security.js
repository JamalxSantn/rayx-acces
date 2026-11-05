import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Site activity logs with search + detailed filtering.
router.get('/logs', (req, res) => {
  const { q = '', level = 'all', actor = 'all' } = req.query;
  let rows = db.prepare('SELECT * FROM security_logs ORDER BY id DESC LIMIT 1000').all();
  const term = String(q).toLowerCase().trim();
  if (term)
    rows = rows.filter(
      (l) =>
        (l.action || '').toLowerCase().includes(term) ||
        (l.actor || '').toLowerCase().includes(term) ||
        (l.target || '').toLowerCase().includes(term) ||
        (l.detail || '').toLowerCase().includes(term)
    );
  if (level !== 'all') rows = rows.filter((l) => l.level === level);
  if (actor !== 'all') rows = rows.filter((l) => l.actor === actor);

  const actors = [...new Set(db.prepare('SELECT DISTINCT actor FROM security_logs').all().map((r) => r.actor).filter(Boolean))];
  res.json({ logs: rows, actors });
});

export default router;
