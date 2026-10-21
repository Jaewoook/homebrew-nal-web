import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as dispatchHandler } from '@/app/api/builds/dispatch/route';
import { GET as buildsHandler } from '@/app/api/builds/route';
import { GET as formulasHandler } from '@/app/api/formulas/route';
import { initDatabase } from '@/lib/dispatch-store';
import { resetRateLimiter } from '@/lib/rate-limiter';

describe('Builds and Formulas API Routes', () => {
  beforeEach(() => {
    initDatabase(':memory:');
    resetRateLimiter();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated dispatch requests with 401', async () => {
    const req = new Request('http://localhost:3000/api/builds/dispatch', {
      method: 'POST',
      body: JSON.stringify({ formula: 'ffmpeg-nal' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await dispatchHandler(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid formula names with 400', async () => {
    const req = new Request('http://localhost:3000/api/builds/dispatch', {
      method: 'POST',
      body: JSON.stringify({ formula: '../../bad-path' }),
      headers: { 'Content-Type': 'application/json', 'x-mock-user': 'jaewook' },
    });
    const res = await dispatchHandler(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid dispatch request and records attribution in SQLite', async () => {
    const req = new Request('http://localhost:3000/api/builds/dispatch', {
      method: 'POST',
      body: JSON.stringify({ formula: 'ffmpeg-nal' }),
      headers: {
        'Content-Type': 'application/json',
        'x-mock-user': 'jaewook',
        'x-mock-email': 'jaewook@nal.local',
      },
    });

    const res = await dispatchHandler(req);
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.formula).toBe('ffmpeg-nal');
    expect(data.requested_by).toBe('jaewook');
  });

  it('enforces rate limit of 3 dispatches per user and returns 429', async () => {
    const makeReq = () =>
      new Request('http://localhost:3000/api/builds/dispatch', {
        method: 'POST',
        body: JSON.stringify({ formula: 'ffmpeg-nal' }),
        headers: {
          'Content-Type': 'application/json',
          'x-mock-user': 'jaewook',
        },
      });

    await dispatchHandler(makeReq());
    await dispatchHandler(makeReq());
    await dispatchHandler(makeReq());

    const fourth = await dispatchHandler(makeReq());
    expect(fourth.status).toBe(429);
    const body = await fourth.json();
    expect(body.error).toBe('Too Many Requests');
  });

  it('GET /api/formulas returns catalog of formulas', async () => {
    const req = new Request('http://localhost:3000/api/formulas');
    const res = await formulasHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.formulas).toBeDefined();
    expect(Array.isArray(data.formulas)).toBe(true);
    expect(data.total).toBeGreaterThan(0);
  });

  it('GET /api/builds returns list of active and recent runs', async () => {
    const res = await buildsHandler();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runs).toBeDefined();
    expect(Array.isArray(data.runs)).toBe(true);
  });
});
