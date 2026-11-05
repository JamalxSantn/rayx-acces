import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Website admin accounts (never expose secrets/hashes).
router.get('/website-users', (req, res) => {
  const { q = '' } = req.query;
  let rows = db
    .prepare('SELECT id, username, role, totp_enabled, created_at FROM website_users ORDER BY id ASC')
    .all();
  const term = String(q).toLowerCase().trim();
  if (term) rows = rows.filter((u) => u.username.toLowerCase().includes(term));
  res.json({ users: rows.map((u) => ({ ...u, totp_enabled: !!u.totp_enabled })) });
});

export default router;
