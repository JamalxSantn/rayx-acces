import { Router } from 'express';
import db from '../db.js';
import { requireAuth, decorateKey, log } from '../lib.js';
import { lookupDiscordUser } from '../discord.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM screenshots ORDER BY id DESC').all();
  res.json({ screenshots: rows });
});

// Screenshot detail joins any key/discord info for the pictured user.
router.get('/:id', async (req, res) => {
  const shot = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(req.params.id);
  if (!shot) return res.status(404).json({ error: 'Screenshot not found.' });

  let holder = null;
  if (shot.discord_id) {
    const keys = db
      .prepare('SELECT * FROM license_keys WHERE discord_id = ? ORDER BY created_at DESC')
      .all(shot.discord_id)
      .map(decorateKey);
    const lookup = await lookupDiscordUser(shot.discord_id);
    holder = {
      discord_id: shot.discord_id,
      discord_username: lookup.username || keys[0]?.discord_username || null,
      discord_avatar: lookup.avatar || keys[0]?.discord_avatar || null,
      keys,
      banned: keys.some((k) => k.banned),
    };
  }
  res.json({ screenshot: shot, holder });
});

router.post('/', (req, res) => {
  const title = String(req.body.title || '').trim();
  const image_url = String(req.body.image_url || '').trim();
  const discord_id = String(req.body.discord_id || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;
  if (!title || !image_url) return res.status(400).json({ error: 'Title and image URL are required.' });
  if (title.length > 200) return res.status(400).json({ error: 'Title is too long (max 200).' });
  if (image_url.length > 2048 || !/^https?:\/\//i.test(image_url))
    return res.status(400).json({ error: 'Image URL must be a valid http(s) link.' });
  if (note && note.length > 2000) return res.status(400).json({ error: 'Note is too long (max 2000).' });
  if (discord_id && !/^\d{17,20}$/.test(discord_id)) return res.status(400).json({ error: 'Invalid Discord ID.' });
  const info = db
    .prepare('INSERT INTO screenshots (title, image_url, discord_id, note) VALUES (?, ?, ?, ?)')
    .run(title, image_url, discord_id, note);
  log({ actor: req.user.username, action: 'Screenshot added', target: title, level: 'info' });
  res.json({ screenshot: db.prepare('SELECT * FROM screenshots WHERE id = ?').get(info.lastInsertRowid) });
});

export default router;
