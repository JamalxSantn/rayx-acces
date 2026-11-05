// Minimal in-memory rate limiter / lockout for the auth endpoints — no deps.
// Protects against password brute-force and (critically) TOTP code guessing,
// since a 6-digit code is trivially brute-forceable without a lockout.

const buckets = new Map(); // key -> { fails, first, lockedUntil }

const PRUNE_INTERVAL = 5 * 60 * 1000;
const KEEP_FOR = 60 * 60 * 1000;
let lastPrune = 0;

function prune(now) {
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [k, v] of buckets) {
    if ((v.lockedUntil || 0) < now && now - v.first > KEEP_FOR) buckets.delete(k);
  }
}

// Returns seconds remaining on the lock, or 0 if not locked.
export function checkLock(key) {
  const now = Date.now();
  const b = buckets.get(key);
  if (b && b.lockedUntil && b.lockedUntil > now) return Math.ceil((b.lockedUntil - now) / 1000);
  return 0;
}

// Record a failed attempt; locks the key once `max` fails happen inside `windowMs`.
export function recordFail(key, { max = 8, windowMs = 15 * 60 * 1000, lockMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  prune(now);
  let b = buckets.get(key);
  if (!b || now - b.first > windowMs) b = { fails: 0, first: now, lockedUntil: 0 };
  b.fails += 1;
  if (b.fails >= max) b.lockedUntil = now + lockMs;
  buckets.set(key, b);
}

export function recordSuccess(key) {
  buckets.delete(key);
}

// Best-effort client IP (works for localhost / direct connections).
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
