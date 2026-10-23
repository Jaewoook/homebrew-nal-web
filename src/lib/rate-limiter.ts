interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Evict expired entries to prevent memory creep
function pruneExpiredEntries(now: number, windowMs: number): void {
  for (const [key, entry] of rateLimitMap.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 3,
  windowMs: number = 5 * 60 * 1000 // default 5 minutes
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Periodic pruning when size threshold is reached
  if (rateLimitMap.size > 100) {
    pruneExpiredEntries(now, windowMs);
  }

  const entry = rateLimitMap.get(key) || { timestamps: [] };

  // Remove timestamps outside window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.timestamps.push(now);
  rateLimitMap.set(key, entry);
  return { allowed: true };
}

export function resetRateLimiter(): void {
  rateLimitMap.clear();
}
