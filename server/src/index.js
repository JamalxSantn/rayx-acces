import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { PORT, BOT_API_KEY_IS_DEFAULT } from './config.js';
import './db.js';

import authRoutes from './routes/auth.js';
import keyRoutes from './routes/keys.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import communityRoutes from './routes/community.js';
import securityRoutes from './routes/security.js';
import screenshotRoutes from './routes/screenshots.js';
import adminRoutes from './routes/admin.js';
import botRoutes from './routes/bot.js';
import hwidRoutes from './routes/hwid.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Render (and any reverse proxy) terminates TLS in front of us; trust one hop
// so req.ip / rate limiting see the real client address.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- Security headers (defense-in-depth; safe for this app's assets) ----
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY'); // no embedding the panel in an iframe
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
  );
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Rayx Acces', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/screenshots', screenshotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/hwid', hwidRoutes);

// ---- Serve the built client in production (npm run build && npm start) ----
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  // Service-layer errors carry an HTTP status; everything else is a 500.
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n  Rayx Acces API running on http://localhost:${PORT}\n`);
  if (BOT_API_KEY_IS_DEFAULT) {
    console.warn('  [security] BOT_API_KEY is the default value. Set a strong BOT_API_KEY in');
    console.warn('             server/.env and the matching key in bot/config.json for production.\n');
  }
});
