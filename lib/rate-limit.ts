/**
 * Minimal fixed-window rate limiter, kept in memory per server instance.
 * Good enough to stop someone using the waitlist form to spam arbitrary
 * inboxes from your Gmail account; use a shared store (e.g. Redis) at scale.
 */

interface Window {
  count: number;
  resetAt: number;
}

const globalForLimit = globalThis as typeof globalThis & { __hyperdriveRateLimit?: Map<string, Window> };
const windows = (globalForLimit.__hyperdriveRateLimit ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  // Opportunistic cleanup so the map can't grow without bound.
  if (windows.size > 10_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }
  if (current.count >= limit) {
    return { ok: false as const, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count++;
  return { ok: true as const };
}

/** Best-effort client IP from standard proxy headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
