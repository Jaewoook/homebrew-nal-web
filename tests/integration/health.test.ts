import { describe, it, expect } from 'vitest';
import { GET as healthHandler } from '@/app/api/health/route';

describe('Health Check Endpoint', () => {
  it('returns 200 OK with status healthy and timestamp', async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.service).toBe('homebrew-nal-web');
  });
});
