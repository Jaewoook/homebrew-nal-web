import { getUpstreamCache, saveUpstreamCache } from './db';

interface UpstreamApiResponse {
  versions?: {
    stable?: string;
  };
}

const memoryCache = new Map<string, { version: string | null; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL for upstream Core versions

async function getFromDb(formulaName: string): Promise<{ version: string | null; timestamp: number } | null> {
  if (process.env.NODE_ENV === 'test') return null;
  try {
    const row = await getUpstreamCache(formulaName);
    if (row) {
      return { version: row.version, timestamp: row.updated_at };
    }
  } catch {
    // Non-fatal
  }
  return null;
}

async function saveToDb(formulaName: string, version: string | null, timestamp: number): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await saveUpstreamCache(formulaName, version, timestamp);
  } catch {
    // Non-fatal
  }
}

export async function checkUpstreamVersion(formulaName: string): Promise<string | null> {
  const now = Date.now();
  const cached = memoryCache.get(formulaName) || (await getFromDb(formulaName));
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    memoryCache.set(formulaName, cached);
    return cached.version;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const res = await fetch(`https://formulae.brew.sh/api/formula/${encodeURIComponent(formulaName)}.json`, {
      signal: controller?.signal,
    });
    if (!res.ok) {
      memoryCache.set(formulaName, { version: null, timestamp: now });
      await saveToDb(formulaName, null, now);
      return null;
    }

    const data = (await res.json()) as UpstreamApiResponse;
    const version = data.versions?.stable ?? null;
    memoryCache.set(formulaName, { version, timestamp: now });
    await saveToDb(formulaName, version, now);
    return version;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Failed to fetch upstream version for ${formulaName}:`, error);
    }
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
