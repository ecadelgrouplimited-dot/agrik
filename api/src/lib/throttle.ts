/**
 * A small in-process attempt counter for the handful of endpoints where guessing is the
 * attack. It is deliberately not a general rate limiter: it holds state in memory, so a
 * restart clears it and a second API process would count separately. That is an accepted
 * trade-off for a single-node deployment — the goal is to make online password guessing
 * slow, not to be an edge WAF.
 */
type Attempt = { count: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Attempt>();

export type ThrottleOptions = {
  /** Attempts allowed inside the window before the key is blocked. */
  limit: number;
  /** Rolling window, in milliseconds. */
  windowMs: number;
  /** How long a key stays blocked once it trips the limit. */
  blockMs: number;
};

export type ThrottleVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkThrottle(key: string, options: ThrottleOptions): ThrottleVerdict {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) return { allowed: true };
  if (record.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (now - record.firstAt > options.windowMs) {
    attempts.delete(key);
  }
  return { allowed: true };
}

/** Call after a failed attempt. Returns true when this failure tripped the block. */
export function recordFailure(key: string, options: ThrottleOptions): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > options.windowMs) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return false;
  }

  record.count += 1;
  if (record.count >= options.limit) {
    record.blockedUntil = now + options.blockMs;
    return true;
  }
  return false;
}

/** Call after a successful attempt, so a legitimate sign-in clears the counter. */
export function clearThrottle(key: string) {
  attempts.delete(key);
}

// Keys are only interesting while they are counting; drop the rest so the map cannot grow
// without bound on a long-running process.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (record.blockedUntil < now && now - record.firstAt > SWEEP_INTERVAL_MS) {
      attempts.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS).unref();
