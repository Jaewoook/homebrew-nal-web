import { describe, it, expect, beforeEach } from 'vitest';
import { recordDispatch, getRecentDispatches, findDispatchForFormula, initDatabase } from '@/lib/dispatch-store';

describe('Dispatch Store', () => {
  beforeEach(() => {
    initDatabase(':memory:');
  });

  it('records a new build dispatch and retrieves it', () => {
    const record = recordDispatch('ffmpeg-nal', 'jaewook', 'jaewook@nal.local');
    expect(record.formula).toBe('ffmpeg-nal');
    expect(record.requested_by).toBe('jaewook');
    expect(record.id).toBeDefined();

    const list = getRecentDispatches();
    expect(list.length).toBe(1);
    expect(list[0].formula).toBe('ffmpeg-nal');
  });

  it('finds latest dispatch for a specific formula', () => {
    recordDispatch('nal-core', 'alice');
    recordDispatch('ffmpeg-nal', 'jaewook');

    const found = findDispatchForFormula('ffmpeg-nal');
    expect(found).not.toBeNull();
    expect(found?.requested_by).toBe('jaewook');

    const notFound = findDispatchForFormula('unknown-tool');
    expect(notFound).toBeNull();
  });
});
