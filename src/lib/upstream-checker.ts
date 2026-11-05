import { getUpstreamCache, saveUpstreamCache } from './db';

interface UpstreamApiResponse {
  version?: string;
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

export async function checkUpstreamVersion(
  formulaName: string,
  packageType: 'formula' | 'cask' = 'formula'
): Promise<string | null> {
  const now = Date.now();
  const cacheKey = packageType === 'cask' ? `cask:${formulaName}` : formulaName;
  const cached = memoryCache.get(cacheKey) || (await getFromDb(cacheKey));
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    memoryCache.set(cacheKey, cached);
    return cached.version;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

  const endpoint =
    packageType === 'cask'
      ? `https://formulae.brew.sh/api/cask/${encodeURIComponent(formulaName)}.json`
      : `https://formulae.brew.sh/api/formula/${encodeURIComponent(formulaName)}.json`;

  try {
    const res = await fetch(endpoint, {
      signal: controller?.signal,
    });
    if (!res.ok) {
      memoryCache.set(cacheKey, { version: null, timestamp: now });
      await saveToDb(cacheKey, null, now);
      return null;
    }

    const data = (await res.json()) as UpstreamApiResponse;
    const rawVersion = packageType === 'cask' ? (data.version ?? null) : (data.versions?.stable ?? null);
    const version = rawVersion ? rawVersion.split(',')[0] : null;
    memoryCache.set(cacheKey, { version, timestamp: now });
    await saveToDb(cacheKey, version, now);
    return version;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`Failed to fetch upstream version for ${cacheKey}:`, error);
    }
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
