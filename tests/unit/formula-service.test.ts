import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFormulaCatalog, setCatalogCacheForTesting } from '@/lib/formula-service';

describe('Formula Service Cache Preservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves and returns existing cached catalog when GitHub API fails', async () => {
    const existingCatalog = {
      formulas: [
        {
          name: 'real-tool',
          version: '3.0.0',
          desc: 'A real tool in tap',
          dependencies: [],
          hasBottle: true,
        },
      ],
      total: 1,
      lastUpdated: '2026-10-21T00:00:00Z',
    };

    setCatalogCacheForTesting(existingCatalog, Date.now() - 100000); // expired cache

    // Mock GitHub fetch returning 403 Rate Limit
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('api.github.com')) {
        return { ok: false, status: 403, statusText: 'Rate limit exceeded' } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await getFormulaCatalog(true); // forceRefresh
    // Should preserve 'real-tool', NOT overwrite with SAMPLE_FORMULAS
    expect(result.formulas.some((f) => f.name === 'real-tool')).toBe(true);
    expect(result.formulas.some((f) => f.name === 'caddy-nal')).toBe(false);
  });
});
