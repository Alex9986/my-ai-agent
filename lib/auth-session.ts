// Session-scoped auth storage. No React and no browser globals — the storage
// area is injected, so the rules below can be unit-tested with a fake.
//
// Why this module exists: the session used to live in localStorage, which is
// permanent for the origin. Closing the browser and reopening the page silently
// signed the last user back in. sessionStorage is the correct home for a login:
// it survives a reload inside the tab, and is dropped when the tab — and
// therefore the browser — closes.

export const AUTH_STORAGE_KEY = "ai-todo-auth";

/** The subset of the Storage interface this module needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AuthState {
  username: string;
}

/** Rejects anything that is not `{ username: "<non-empty string>" }`. */
function isAuthState(value: unknown): value is AuthState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { username?: unknown };
  return typeof candidate.username === "string" && candidate.username.length > 0;
}

/** Returns the stored session, or null when absent or unreadable. */
export function readAuthState(storage: StorageLike): AuthState | null {
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthState(parsed) ? { username: parsed.username } : null;
  } catch {
    return null;
  }
}

/**
 * Persists the session for the current tab. A failure here is not fatal — the
 * user stays signed in for this page load, the session just won't survive a
 * reload. That beats failing an otherwise successful login.
 */
export function writeAuthState(storage: StorageLike, state: AuthState): void {
  try {
    storage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ username: state.username })
    );
  } catch {
    // Storage disabled (private mode) or over quota — ignore.
  }
}

export function clearAuthState(storage: StorageLike): void {
  try {
    storage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Drops the entry written by the previous localStorage-based build.
 *
 * Without this, an already-signed-in browser keeps a stale username on disk
 * indefinitely — readable long after the session that created it ended.
 */
export function purgeLegacyAuthState(legacyStorage: StorageLike): void {
  clearAuthState(legacyStorage);
}

/**
 * Resolves the session for a freshly loaded document.
 *
 * A tab that has just been opened — or a browser that has just been started —
 * has an empty sessionStorage, so this returns null and the app shows the login
 * screen. The legacy localStorage entry is purged on the way through so it can
 * never be mistaken for a live session.
 */
export function restoreSession(
  session: StorageLike | null,
  legacy: StorageLike | null
): AuthState | null {
  if (legacy) purgeLegacyAuthState(legacy);
  return session ? readAuthState(session) : null;
}
