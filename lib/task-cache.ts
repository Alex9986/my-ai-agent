// Pure policy for the per-user task cache. No React, no DOM — so the isolation
// rules can be unit-tested directly.

const STORAGE_KEY_PREFIX = "ai-todo-tasks";

/**
 * Cache key is scoped per user. A single shared key meant that when the server
 * was unreachable, whoever logged in next would read the *previous* user's
 * cached tasks — and then push them back to the server under their own name.
 */
export function storageKeyFor(username: string): string {
  return `${STORAGE_KEY_PREFIX}:${username}`;
}

/** How the task list currently in state was obtained. */
export type TaskOrigin = "server" | "cache" | "sample";

/** Why a task sync was skipped. */
export type SyncSkipReason =
  | "no-user"
  | "not-ready"
  | "wrong-owner"
  | "sample-data"
  | "unchanged";

export interface SyncDecisionInput {
  username: string | null;
  ready: boolean;
  /** Which user the tasks currently in state belong to. */
  dataOwner: string | null;
  /** How those tasks were obtained. */
  dataOrigin: TaskOrigin | null;
  /** True when the array in state is still the one the loader produced. */
  unchangedSinceLoad: boolean;
}

/**
 * Pure decision — may the task list in state be published (written to this
 * user's cache and pushed to the server)?
 *
 * Returns null to proceed, or the reason to skip.
 */
export function evaluateTaskSync(input: SyncDecisionInput): SyncSkipReason | null {
  if (!input.username) return "no-user";
  if (!input.ready) return "not-ready";
  // Never publish a list that belongs to somebody else — this is what stops
  // user A's tasks from being written under user B's name.
  if (input.dataOwner !== input.username) return "wrong-owner";
  // Seeded demo data must not overwrite real server data. This happens when the
  // tasks endpoint is unreachable and the user has no cache yet.
  if (input.dataOrigin === "sample") return "sample-data";
  // Nothing changed since the load — no need to write anything back.
  if (input.unchangedSinceLoad) return "unchanged";
  return null;
}
