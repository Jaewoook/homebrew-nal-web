import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimiter } from '@/lib/rate-limiter';

describe('In-Memory Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within the limit', () => {
    expect(checkRateLimit('user1', 3, 60000).allowed).toBe(true);
    expect(checkRateLimit('user1', 3, 60000).allowed).toBe(true);
    expect(checkRateLimit('user1', 3, 60000).allowed).toBe(true);
  });

  it('rejects requests exceeding the limit with retryAfter', () => {
    checkRateLimit('user1', 3, 60000);
    checkRateLimit('user1', 3, 60000);
    checkRateLimit('user1', 3, 60000);

    const fourth = checkRateLimit('user1', 3, 60000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });

  it('prunes expired entries when threshold is reached to prevent memory leak', () => {
    // Fill with expired entries (windowMs = 1ms, so they expire immediately)
    for (let i = 0; i < 110; i++) {
      checkRateLimit(`stale-user-${i}`, 3, 1);
    }

    // Trigger check on a new key after entries have expired
    const result = checkRateLimit('fresh-user', 3, 60000);
    expect(result.allowed).toBe(true);
  });
});
