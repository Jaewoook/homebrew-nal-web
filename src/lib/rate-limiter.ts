interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 3,
  windowMs: number = 5 * 60 * 1000 // default 5 minutes
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
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
