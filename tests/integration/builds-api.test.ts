import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as dispatchHandler } from '@/app/api/builds/dispatch/route';
import { GET as buildsHandler } from '@/app/api/builds/route';
import { GET as formulasHandler } from '@/app/api/formulas/route';
import { initDatabase } from '@/lib/dispatch-store';
import { resetRateLimiter } from '@/lib/rate-limiter';
import { createSignedSessionCookie } from '@/lib/auth';

describe('Builds and Formulas API Routes', () => {
  let authCookie: string;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-key-32-chars-long-12345';
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PAT;
    authCookie = `nal_session=${createSignedSessionCookie({ name: 'jaewook', email: 'jaewook@nal.local' })}`;
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
      headers: { 'Content-Type': 'application/json', cookie: authCookie },
    });
    const res = await dispatchHandler(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid dispatch request and records attribution in SQLite', async () => {
    process.env.GITHUB_TOKEN = 'test-token-123';
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/dispatches')) {
        return { ok: true, status: 204 } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    const req = new Request('http://localhost:3000/api/builds/dispatch', {
      method: 'POST',
      body: JSON.stringify({ formula: 'ffmpeg-nal' }),
      headers: {
        'Content-Type': 'application/json',
        cookie: authCookie,
      },
    });

    const res = await dispatchHandler(req);
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.formula).toBe('ffmpeg-nal');
    expect(data.requested_by).toBe('jaewook');
  });

  it('returns 502 when GitHub Actions workflow dispatch fails', async () => {
    process.env.GITHUB_TOKEN = 'test-token-123';
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/dispatches')) {
        return { ok: false, status: 403, text: async () => 'Resource not accessible' } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const req = new Request('http://localhost:3000/api/builds/dispatch', {
      method: 'POST',
      body: JSON.stringify({ formula: 'ffmpeg-nal' }),
      headers: {
        'Content-Type': 'application/json',
        cookie: authCookie,
      },
    });

    const res = await dispatchHandler(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe('Dispatch failed');
  });

  it('enforces rate limit of 3 dispatches per user and returns 429', async () => {
    process.env.GITHUB_TOKEN = 'test-token-123';
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/dispatches')) {
        return { ok: true, status: 204 } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    const makeReq = () =>
      new Request('http://localhost:3000/api/builds/dispatch', {
        method: 'POST',
        body: JSON.stringify({ formula: 'ffmpeg-nal' }),
        headers: {
          'Content-Type': 'application/json',
          cookie: authCookie,
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
    expect(data.total).toBeGreaterThanOrEqual(20);
    const ffmpeg = data.formulas.find((f: any) => f.name === 'ffmpeg');
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg.releaseTag).toBe('ffmpeg.9.0.2_1');
    expect(ffmpeg.bottleUrl).toContain('ffmpeg-9.0.2_1');
  }, 15000);

  it('GET /api/builds returns list of active and recent runs', async () => {
    const res = await buildsHandler();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runs).toBeDefined();
    expect(Array.isArray(data.runs)).toBe(true);
  });

  it('GET /api/builds returns 502 with error message when GitHub API fails', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/actions/runs')) {
        return { ok: false, status: 503, statusText: 'Service Unavailable' } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const res = await buildsHandler();
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe('Failed to fetch build runs');
    expect(data.runs).toEqual([]);
  });
});
