import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const PORT = process.env.PORT || 3001;
export const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Rayx Acces';

// JWT signing secret. If an explicit env var is set, use it (stable across
// restarts). Otherwise generate a FRESH random secret on every boot — this
// means restarting the server invalidates all tokens, logging everyone out.
export const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
    ? process.env.JWT_SECRET
    : crypto.randomBytes(48).toString('hex');

// Shared secret the Discord bot uses to talk to this API.
// The bot's config.json -> api.key MUST match this value.
export const BOT_API_KEY = process.env.BOT_API_KEY || 'rayx-bot-dev-key-change-me';
export const BOT_API_KEY_IS_DEFAULT = !process.env.BOT_API_KEY;

// Secret phrase that grants the hidden owner session (typed on the 404 page).
export const SECRET_PHRASE = process.env.SECRET_PHRASE || '@00RYZEX00!';
