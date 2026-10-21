import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFormulaCatalog, setCatalogCacheForTesting, fetchReleasesMap } from '@/lib/formula-service';

describe('Formula Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCatalogCacheForTesting(null as any, 0);
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
    // Should preserve 'real-tool', NOT overwrite with FALLBACK_FORMULAS
    expect(result.formulas.some((f) => f.name === 'real-tool')).toBe(true);
    expect(result.formulas.some((f) => f.name === 'caddy-nal')).toBe(false);
  });

  it('fetches and maps GitHub releases to formulas with bottle asset details', async () => {
    const mockReleases = [
      {
        tag_name: 'ffmpeg.9.0.2_1',
        name: 'ffmpeg 9.0.2_1',
        html_url: 'https://github.com/Jaewoook/homebrew-nal/releases/tag/ffmpeg.9.0.2_1',
        published_at: '2026-10-14T16:41:32Z',
        assets: [
          {
            name: 'ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
            size: 22173600,
            browser_download_url: 'https://github.com/Jaewoook/homebrew-nal/releases/download/ffmpeg.9.0.2_1/ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
            digest: 'sha256:5afb7967a84db5ccc3d4a8e0ac2cb7aa3db0408e5b6dece5cefc9aeaa55b86f1',
          },
        ],
      },
      {
        tag_name: 'tmux.3.8',
        name: 'tmux 3.8',
        html_url: 'https://github.com/Jaewoook/homebrew-nal/releases/tag/tmux.3.8',
        published_at: '2026-10-20T06:57:12Z',
        assets: [
          {
            name: 'tmux-3.8.sequoia.bottle.1.tar.gz',
            size: 647515,
            browser_download_url: 'https://github.com/Jaewoook/homebrew-nal/releases/download/tmux.3.8/tmux-3.8.sequoia.bottle.1.tar.gz',
          },
        ],
      },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/releases')) {
        return {
          ok: true,
          json: async () => mockReleases,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const releaseMap = await fetchReleasesMap();
    expect(releaseMap['ffmpeg']).toBeDefined();
    expect(releaseMap['ffmpeg'].tagName).toBe('ffmpeg.9.0.2_1');
    expect(releaseMap['ffmpeg'].bottleAsset?.name).toBe('ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz');
    expect(releaseMap['ffmpeg'].bottleAsset?.size).toBe(22173600);
    expect(releaseMap['ffmpeg'].bottleAsset?.platform).toBe('sequoia');
    expect(releaseMap['tmux'].tagName).toBe('tmux.3.8');
    expect(releaseMap['tmux'].bottleAsset?.size).toBe(647515);
  });

  it('decorates formula items with release tags and direct bottle download metadata', async () => {
    const mockReleases = [
      {
        tag_name: 'ffmpeg.9.0.2_1',
        name: 'ffmpeg 9.0.2_1',
        html_url: 'https://github.com/Jaewoook/homebrew-nal/releases/tag/ffmpeg.9.0.2_1',
        published_at: '2026-10-14T16:41:32Z',
        assets: [
          {
            name: 'ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
            size: 22173600,
            browser_download_url: 'https://github.com/Jaewoook/homebrew-nal/releases/download/ffmpeg.9.0.2_1/ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz',
          },
        ],
      },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/releases')) {
        return { ok: true, json: async () => mockReleases } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const catalog = await getFormulaCatalog(true);
    const ffmpeg = catalog.formulas.find((f) => f.name === 'ffmpeg');
    expect(ffmpeg).toBeDefined();
    if (ffmpeg) {
      expect(ffmpeg.releaseTag).toBe('ffmpeg.9.0.2_1');
      expect(ffmpeg.bottleUrl).toBe(
        'https://github.com/Jaewoook/homebrew-nal/releases/download/ffmpeg.9.0.2_1/ffmpeg-9.0.2_1.sequoia.bottle.1.tar.gz'
      );
      expect(ffmpeg.bottleSize).toBe(22173600);
      expect(ffmpeg.bottlePlatform).toBe('sequoia');
    }
  });
});
