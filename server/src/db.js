import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR lets a host mount a persistent disk for the SQLite file
// (Render: mount a disk at /var/data, set DATA_DIR=/var/data).
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ryzexauth.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS website_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license_keys (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  key_value        TEXT UNIQUE NOT NULL,
  discord_id       TEXT NOT NULL,
  discord_username TEXT,
  discord_avatar   TEXT,
  plan             TEXT NOT NULL,            -- month | 3months | year | lifetime
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at       TEXT,                     -- NULL for lifetime
  banned           INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT
);

CREATE TABLE IF NOT EXISTS changelogs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author     TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT 'update', -- update | feature | fix | announcement
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_chat (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  username   TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  level      TEXT NOT NULL DEFAULT 'info',   -- info | success | warning | danger
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS screenshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  discord_id TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registration keys: required to create a website account. Generated via createkey.py.
CREATE TABLE IF NOT EXISTS register_keys (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key_value  TEXT UNIQUE NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  used_by    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at    TEXT
);

-- Main-server member list, kept in sync by the Discord bot. Used to reject
-- granting access to someone who is not in the main server.
CREATE TABLE IF NOT EXISTS guild_members (
  discord_id TEXT PRIMARY KEY,
  synced_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outbox of DMs for the bot to deliver (e.g. "you are now a member").
-- Written by the site/bot when a membership is created, drained by the bot.
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  data       TEXT,
  delivered  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---- Bootstrap: seed one registration key only on a brand-new install ----
const regCount = db.prepare('SELECT COUNT(*) AS c FROM register_keys').get().c;
const userCount = db.prepare('SELECT COUNT(*) AS c FROM website_users').get().c;
if (regCount === 0 && userCount === 0) {
  const seg = () =>
    Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const bootstrapKey = `RAYX-REG-${seg()}-${seg()}`;
  db.prepare('INSERT INTO register_keys (key_value) VALUES (?)').run(bootstrapKey);
  console.log('\n  ======================================================');
  console.log('   Rayx Acces - bootstrap registration key');
  console.log('   ' + bootstrapKey);
  console.log('   Use it on the Register page to create your admin.');
  console.log('   Generate more anytime with:  python createkey.py');
  console.log('  ======================================================\n');
}

// ---- Lightweight migrations (add columns to existing installs) ----
function ensureColumn(table, col, defn) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defn}`);
}
ensureColumn('license_keys', 'uuid', 'TEXT');
ensureColumn('license_keys', 'frozen', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('license_keys', 'frozen_at', 'TEXT');
ensureColumn('license_keys', 'ban_reason', 'TEXT');

// ---- Seed an example screenshot once ----
const shotCount = db.prepare('SELECT COUNT(*) AS c FROM screenshots').get().c;
if (shotCount === 0) {
  db.prepare(
    `INSERT INTO screenshots (title, image_url, discord_id, note)
     VALUES (?, ?, ?, ?)`
  ).run(
    'Example — Cheat detection capture',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    '159985870458322944',
    'Auto-captured screenshot from the game client (example entry).'
  );
}

export default db;
