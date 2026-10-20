interface UpstreamApiResponse {
  versions?: {
    stable?: string;
  };
}

const cache = new Map<string, { version: string | null; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function checkUpstreamVersion(formulaName: string): Promise<string | null> {
  const cached = cache.get(formulaName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.version;
  }

  try {
    const res = await fetch(`https://formulae.brew.sh/api/formula/${encodeURIComponent(formulaName)}.json`);
    if (!res.ok) {
      cache.set(formulaName, { version: null, timestamp: Date.now() });
      return null;
    }

    const data = (await res.json()) as UpstreamApiResponse;
    const version = data.versions?.stable ?? null;
    cache.set(formulaName, { version, timestamp: Date.now() });
    return version;
  } catch (error) {
    console.error(`Failed to fetch upstream version for ${formulaName}:`, error);
    return null;
  }
}
