// Where the session token/user live.
//  - Normal accounts -> localStorage (survive tab close; cleared on server
//    restart because the server rotates its JWT secret each boot).
//  - Hidden owner (id 0) -> sessionStorage, so closing the tab logs it out.
const TOKEN = 'ryzex_token';
const USERK = 'ryzex_user';

export function getToken() {
  return sessionStorage.getItem(TOKEN) || localStorage.getItem(TOKEN);
}

export function getUser() {
  const raw = sessionStorage.getItem(USERK) || localStorage.getItem(USERK);
  try {
    return JSON.parse(raw || 'null');
  } catch {
    return null;
  }
}

export function setAuth(token, u) {
  const ephemeral = u?.id === 0; // the hidden owner
  const primary = ephemeral ? sessionStorage : localStorage;
  const secondary = ephemeral ? localStorage : sessionStorage;
  secondary.removeItem(TOKEN);
  secondary.removeItem(USERK);
  primary.setItem(TOKEN, token);
  primary.setItem(USERK, JSON.stringify(u));
}

export function clearAuth() {
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem(TOKEN);
    s.removeItem(USERK);
  }
}
