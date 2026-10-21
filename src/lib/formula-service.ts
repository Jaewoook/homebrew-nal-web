import { Formula, FormulaCatalog } from '@/types/formula';
import { parseFormulaRuby } from './formula-parser';
import { checkUpstreamVersion } from './upstream-checker';

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'jaewoook';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'homebrew-nal';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || '600');

let catalogCache: { data: FormulaCatalog; timestamp: number } | null = null;

export function setCatalogCacheForTesting(data: FormulaCatalog, timestamp: number): void {
  catalogCache = { data, timestamp };
}

// Embedded sample formulas for local development / testing fallback
const SAMPLE_FORMULAS: Record<string, string> = {
  'nal-core': `
    class NalCore < Formula
      desc "NAL Core Homelab Daemon"
      homepage "https://nal.internal"
      url "https://github.com/Jaewoook/nal-core/archive/v1.4.2.tar.gz"
      license "MIT"
      depends_on "openssl@3"
      bottle do
        root_url "https://github.com/jaewoook/homebrew-nal/releases/download/bottles"
        sha256 arm64_sonoma: "abc12345"
      end
    end
  `,
  'ffmpeg-nal': `
    class FfmpegNal < Formula
      desc "Play, record, convert, and stream audio and video with NAL custom flags"
      homepage "https://ffmpeg.org/"
      url "https://ffmpeg.org/releases/ffmpeg-7.0.1.tar.xz"
      license "GPL-2.0-or-later"
      depends_on "pkg-config"
      depends_on "x264"
      depends_on "x265"
      bottle do
        root_url "https://github.com/jaewoook/homebrew-nal/releases/download/bottles"
        sha256 arm64_sonoma: "def67890"
      end
    end
  `,
  'caddy-nal': `
    class CaddyNal < Formula
      desc "Fast and extensible multi-platform HTTP/1-2-3 web server with NAL plugins"
      homepage "https://caddyserver.com/"
      url "https://github.com/caddyserver/caddy/archive/v2.8.4.tar.gz"
      license "Apache-2.0"
      depends_on "go"
      bottle do
        root_url "https://github.com/jaewoook/homebrew-nal/releases/download/bottles"
        sha256 arm64_sonoma: "ghi12345"
      end
    end
  `,
};

export async function getFormulaCatalog(forceRefresh = false): Promise<FormulaCatalog> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.timestamp < CACHE_TTL_SECONDS * 1000) {
    return catalogCache.data;
  }

  const formulas: Formula[] = [];
  let fetchFailed = false;

  try {
    const token = GITHUB_TOKEN || process.env.GITHUB_PAT;
    if (token) {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/Formula`,
        { headers }
      );

      if (res.ok) {
        const files = (await res.json()) as Array<{ name: string; download_url: string }>;
        const rbFiles = files.filter((f) => f.name.endsWith('.rb'));

        for (const file of rbFiles) {
          const name = file.name.replace(/\.rb$/, '');
          const fileRes = await fetch(file.download_url, { headers });
          if (fileRes.ok) {
            const content = await fileRes.text();
            const formula = parseFormulaRuby(name, content);
            const upstream = await checkUpstreamVersion(name);
            formula.upstreamVersion = upstream;
            formula.hasUpdate = Boolean(upstream && upstream !== formula.version);
            formulas.push(formula);
          }
        }
      } else {
        fetchFailed = true;
        console.warn(`GitHub API contents returned ${res.status}: ${res.statusText}`);
      }
    }
  } catch (err) {
    fetchFailed = true;
    console.warn('Failed to fetch formulas from GitHub:', err);
  }

  // If fetch failed but we have an existing cache, preserve and return it (stale-while-revalidate)
  if (fetchFailed && catalogCache) {
    console.info('Serving existing formula cache due to GitHub API error.');
    return catalogCache.data;
  }

  // Fallback to sample formulas if no formulas were fetched and no previous cache exists
  if (formulas.length === 0) {
    if (catalogCache) {
      return catalogCache.data;
    }
    for (const [name, content] of Object.entries(SAMPLE_FORMULAS)) {
      const formula = parseFormulaRuby(name, content);
      const upstream = await checkUpstreamVersion(name);
      formula.upstreamVersion = upstream;
      formula.hasUpdate = Boolean(upstream && upstream !== formula.version);
      formulas.push(formula);
    }
  }

  const catalog: FormulaCatalog = {
    formulas,
    total: formulas.length,
    lastUpdated: new Date().toISOString(),
  };

  catalogCache = { data: catalog, timestamp: now };
  return catalog;
}
