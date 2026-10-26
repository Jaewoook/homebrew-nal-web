import { describe, it, expect, beforeEach } from 'vitest';
import { recordDispatch, getRecentDispatches, findDispatchForFormula, initDatabase } from '@/lib/dispatch-store';

describe('Dispatch Store', () => {
  beforeEach(async () => {
    await initDatabase(':memory:');
  });

  it('records a new build dispatch and retrieves it', async () => {
    const record = await recordDispatch('ffmpeg-nal', 'jaewook', 'jaewook@nal.local');
    expect(record.formula).toBe('ffmpeg-nal');
    expect(record.requested_by).toBe('jaewook');
    expect(record.id).toBeDefined();

    const list = await getRecentDispatches();
    expect(list.length).toBe(1);
    expect(list[0].formula).toBe('ffmpeg-nal');
  });

  it('finds latest dispatch for a specific formula', async () => {
    await recordDispatch('nal-core', 'alice');
    await recordDispatch('ffmpeg-nal', 'jaewook');

    const found = await findDispatchForFormula('ffmpeg-nal');
    expect(found).not.toBeNull();
    expect(found?.requested_by).toBe('jaewook');

    const notFound = await findDispatchForFormula('unknown-tool');
    expect(notFound).toBeNull();
  });
});
