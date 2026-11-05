// Discord lookup + real-ID validation WITHOUT a bot token.
// Uses the public japi.rest lookup API. Falls back to snowflake validation
// + default avatar if the API is unreachable.

const DISCORD_EPOCH = 1420070400000n; // 2015-01-01
const cache = new Map(); // id -> { data, expires }

export function isSnowflakeShaped(id) {
  if (!/^\d{17,20}$/.test(id)) return false;
  try {
    const ts = (BigInt(id) >> 22n) + DISCORD_EPOCH;
    const ms = Number(ts);
    // Must be after Discord launched and not in the future.
    return ms >= 1420070400000 && ms <= Date.now() + 60000;
  } catch {
    return false;
  }
}

function defaultAvatar(id) {
  const idx = Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

// Returns:
//   { valid:true, exists:true, username, avatar, raw }   -> confirmed real user
//   { valid:true, exists:false }                          -> well-formed but no such user
//   { valid:false }                                       -> not a valid snowflake
export async function lookupDiscordUser(id) {
  id = String(id || '').trim();
  if (!isSnowflakeShaped(id)) return { valid: false, exists: false };

  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const res = await fetch(`https://japi.rest/discord/v1/user/${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      const data = { valid: true, exists: false };
      cache.set(id, { data, expires: Date.now() + 5 * 60 * 1000 });
      return data;
    }

    if (res.ok) {
      const json = await res.json();
      const d = json?.data;
      if (d?.id) {
        const data = {
          valid: true,
          exists: true,
          username: d.global_name || d.username || `user_${id.slice(-4)}`,
          avatar: d.avatarURL || d.defaultAvatarURL || defaultAvatar(id),
          bot: !!d.bot,
          raw: d,
        };
        cache.set(id, { data, expires: Date.now() + 60 * 60 * 1000 });
        return data;
      }
    }
    // Rate-limited / unexpected — treat as "cannot confirm", allow with fallback.
    return { valid: true, exists: null, username: null, avatar: defaultAvatar(id), unverified: true };
  } catch {
    // Network error — allow the well-formed ID but flag as unverified.
    return { valid: true, exists: null, username: null, avatar: defaultAvatar(id), unverified: true };
  }
}
