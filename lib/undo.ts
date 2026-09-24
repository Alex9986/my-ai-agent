import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Task, UndoOffer } from "@/lib/types";

/**
 * How long an undo offer stays redeemable. Long enough to notice a mistake,
 * short enough that a stale token is not a licence to resurrect old state.
 */
export const UNDO_TTL_MS = 10 * 60 * 1000;

export interface UndoPayload {
  task: Task;
  /** Position the task occupied when it was removed, so restore is faithful. */
  index: number;
  /** Epoch millis. */
  expiresAt: number;
}

/**
 * Domain separator. The undo key is derived *through* an HMAC rather than used
 * raw, so an API credential is never itself the signing key.
 */
const KEY_DERIVATION_INFO = "ai-todo:undo:v1";

let cachedKey: Buffer | null = null;

/**
 * Signing key for undo tokens.
 *
 * Be clear about what this is: **integrity, not authorization.** The client
 * already supplies the full task list and can PUT whatever it likes, so a
 * forged undo token buys an attacker nothing they could not do directly. What
 * the signature buys is that the server restores exactly the task it deleted,
 * instead of trusting whatever payload the client hands back.
 *
 * Resolution order, most to least explicit:
 *   1. `UNDO_SECRET` — the intended knob.
 *   2. A key derived from `DEEPSEEK_API_KEY`, so a deployment that never sets
 *      `UNDO_SECRET` still gets stable signing without new required config.
 *   3. A random per-process key. Keeps local dev working; tokens then die with
 *      the process, which is fine for a 10-minute offer.
 */
function signingKey(): Buffer {
  if (cachedKey) return cachedKey;

  const explicit = process.env.UNDO_SECRET?.trim();
  if (explicit) {
    cachedKey = createHmac("sha256", explicit).update(KEY_DERIVATION_INFO).digest();
    return cachedKey;
  }

  const seed = process.env.DEEPSEEK_API_KEY?.trim();
  if (seed) {
    cachedKey = createHmac("sha256", seed).update(KEY_DERIVATION_INFO).digest();
    return cachedKey;
  }

  console.warn(
    "[undo] 未配置 UNDO_SECRET，撤销令牌仅在当前进程内有效。生产环境请显式配置。"
  );
  cachedKey = randomBytes(32);
  return cachedKey;
}

function sign(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

/** Bundles a deleted task into a signed, expiring token. */
export function createUndoOffer(
  task: Task,
  index: number,
  now: number = Date.now()
): UndoOffer {
  const payload: UndoPayload = {
    task,
    index,
    expiresAt: now + UNDO_TTL_MS,
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return {
    token: `${body}.${sign(body)}`,
    description: `已删除「${task.title}」`,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

/**
 * Returns the payload only when the signature matches and the token has not
 * expired. Any structural problem is a plain `null` — callers treat every
 * rejection the same way, so there is nothing to gain from finer detail.
 */
export function verifyUndoToken(
  token: string,
  now: number = Date.now()
): UndoPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body), "utf8");
  const actual = Buffer.from(signature, "utf8");

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let payload: UndoPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as UndoPayload;
  } catch {
    return null;
  }

  if (typeof payload?.expiresAt !== "number" || payload.expiresAt < now) {
    return null;
  }
  if (!payload.task || typeof payload.task.id !== "string") return null;
  if (typeof payload.index !== "number" || !Number.isFinite(payload.index)) {
    return null;
  }

  return payload;
}
