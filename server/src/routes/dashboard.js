import { Router } from 'express';
import db from '../db.js';
import { requireAuth, decorateKey, PLAN_LABELS } from '../lib.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', (req, res) => {
  const keys = db.prepare('SELECT * FROM license_keys').all().map(decorateKey);
  const users = new Set(keys.map((k) => k.discord_id));
  const websiteUsers = db.prepare('SELECT COUNT(*) AS c FROM website_users').get().c;

  const active = keys.filter((k) => k.status === 'active').length;
  const expired = keys.filter((k) => k.status === 'expired').length;
  const banned = keys.filter((k) => k.banned).length;

  const planBreakdown = Object.keys(PLAN_LABELS).map((p) => ({
    plan: p,
    label: PLAN_LABELS[p],
    count: keys.filter((k) => k.plan === p).length,
  }));

  // Keys created per day for the last 14 days.
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const count = keys.filter((k) => (k.created_at || '').slice(0, 10) === key).length;
    days.push({ date: key, label: key.slice(5), count });
  }

  const recentLogs = db.prepare('SELECT * FROM security_logs ORDER BY id DESC LIMIT 6').all();
  const recentKeys = keys.slice(0, 5);

  res.json({
    totals: {
      keys: keys.length,
      users: users.size,
      websiteUsers,
      active,
      expired,
      banned,
    },
    planBreakdown,
    timeline: days,
    recentLogs,
    recentKeys,
  });
});

export default router;
