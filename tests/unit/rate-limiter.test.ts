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
});
