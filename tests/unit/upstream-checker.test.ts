import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUpstreamVersion } from '@/lib/upstream-checker';

describe('Upstream Version Checker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns upstream version when formula exists in homebrew-core', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versions: { stable: '1.4.3' }
      })
    } as Response);

    const version = await checkUpstreamVersion('ffmpeg');
    expect(version).toBe('1.4.3');
  });

  it('returns null gracefully when formula does not exist upstream (404)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response);

    const version = await checkUpstreamVersion('nal-custom-internal');
    expect(version).toBeNull();
  });
});
