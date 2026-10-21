import fs from 'fs';
import path from 'path';
import { Formula, FormulaCatalog, FormulaRelease, BottleAsset } from '@/types/formula';
import { parseFormulaRuby } from './formula-parser';
import { checkUpstreamVersion } from './upstream-checker';

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'Jaewoook';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'homebrew-nal';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || '600');

let catalogCache: { data: FormulaCatalog; timestamp: number } | null = null;

export function setCatalogCacheForTesting(data: FormulaCatalog | null, timestamp: number): void {
  catalogCache = data ? { data, timestamp } : null;
}

// Built-in tap formulas for offline or fallback operation (21 formulas in Jaewoook/homebrew-nal)
const FALLBACK_FORMULAS: Record<string, { desc: string; homepage: string; version: string; revision?: number; dependencies: string[]; license?: string }> = {
  coreutils: {
    desc: 'GNU File, Shell, and Text utilities',
    homepage: 'https://www.gnu.org/software/coreutils/',
    version: '9.12',
    dependencies: ['gmp', 'openssl@4'],
    license: 'GPL-3.0-or-later',
  },
  ffmpeg: {
    desc: 'Play, record, convert, and stream select audio and video codecs',
    homepage: 'https://ffmpeg.org/',
    version: '9.0.2',
    revision: 1,
    dependencies: ['dav1d', 'lame', 'libvmaf', 'libvpx', 'openssl@4', 'opus', 'sdl2-compat', 'svt-av1', 'x264', 'x265', 'xz'],
    license: 'GPL-3.0-or-later',
  },
  fzf: {
    desc: 'Command-line fuzzy finder written in Go',
    homepage: 'https://junegunn.github.io/fzf/',
    version: '0.74.5',
    dependencies: [],
    license: 'MIT',
  },
  gcc: {
    desc: 'GNU compiler collection',
    homepage: 'https://gcc.gnu.org/',
    version: '16.2.0',
    dependencies: ['gmp', 'isl', 'libmpc', 'mpfr', 'zstd'],
    license: 'GPL-3.0-or-later',
  },
  gdb: {
    desc: 'GNU debugger',
    homepage: 'https://www.gnu.org/software/gdb/',
    version: '18.1',
    dependencies: ['gmp', 'mpfr', 'python@3.14', 'readline', 'xz', 'zstd'],
    license: 'GPL-3.0-or-later',
  },
  gh: {
    desc: 'GitHub command-line tool',
    homepage: 'https://cli.github.com/',
    version: '2.102.0',
    dependencies: [],
    license: 'MIT',
  },
  git: {
    desc: 'Distributed revision control system',
    homepage: 'https://git-scm.com',
    version: '2.56.0',
    revision: 1,
    dependencies: ['gettext', 'pcre2'],
    license: 'GPL-2.0-only',
  },
  gnupg: {
    desc: 'GNU Privacy Guard (OpenPGP)',
    homepage: 'https://gnupg.org/',
    version: '2.5.24',
    dependencies: ['gnutls', 'libassuan', 'libgcrypt', 'libgpg-error', 'libksba', 'npth', 'pinentry', 'readline'],
    license: 'GPL-3.0-or-later',
  },
  gnutls: {
    desc: 'GNU Transport Layer Security (TLS) Library',
    homepage: 'https://gnutls.org/',
    version: '3.8.13',
    revision: 2,
    dependencies: ['ca-certificates', 'gmp', 'libidn2', 'libtasn1', 'libunistring', 'nettle', 'p11-kit'],
    license: 'LGPL-2.1-or-later',
  },
  go: {
    desc: 'Open source programming language to build simple/reliable/efficient software',
    homepage: 'https://go.dev/',
    version: '1.27.2',
    dependencies: [],
    license: 'BSD-3-Clause',
  },
  jq: {
    desc: 'Lightweight and flexible command-line JSON processor',
    homepage: 'https://jqlang.github.io/jq/',
    version: '1.8.2',
    dependencies: ['oniguruma'],
    license: 'MIT',
  },
  llvm: {
    desc: 'Next-gen compiler infrastructure',
    homepage: 'https://llvm.org/',
    version: '23.1.3',
    revision: 1,
    dependencies: ['zstd', 'xz'],
    license: 'Apache-2.0',
  },
  mole: {
    desc: 'Deep clean and optimize your Mac',
    homepage: 'https://mole.fit',
    version: '1.59.1',
    dependencies: [],
    license: 'MIT',
  },
  node: {
    desc: 'Open-source, cross-platform JavaScript runtime environment',
    homepage: 'https://nodejs.org/',
    version: '26.12.0',
    dependencies: ['brotli', 'c-ares', 'icu4c@78', 'libuv', 'nghttp2', 'openssl@4', 'simdutf'],
    license: 'MIT',
  },
  pinentry: {
    desc: 'Passphrase entry dialog utilizing the Assuan protocol',
    homepage: 'https://www.gnupg.org/related_software/pinentry/',
    version: '1.3.3',
    dependencies: ['libassuan', 'libgpg-error'],
    license: 'GPL-2.0-or-later',
  },
  'pinentry-mac': {
    desc: 'Pinentry for GPG on Mac',
    homepage: 'https://github.com/GPGTools/pinentry',
    version: '1.3.1.1',
    dependencies: ['libassuan', 'libgpg-error'],
    license: 'GPL-2.0-or-later',
  },
  rust: {
    desc: 'Safe, concurrent, practical language',
    homepage: 'https://www.rust-lang.org/',
    version: '1.99.1',
    dependencies: ['openssl@4', 'pkgconf', 'zstd'],
    license: 'Apache-2.0 OR MIT',
  },
  simdutf: {
    desc: 'Unicode conversion routines, fast',
    homepage: 'https://simdutf.github.io/simdutf/',
    version: '9.3.2',
    dependencies: [],
    license: 'Apache-2.0 OR MIT',
  },
  sqlite: {
    desc: 'Command-line interface for SQLite',
    homepage: 'https://sqlite.org/index.html',
    version: '3.54.0',
    dependencies: ['readline', 'zlib'],
    license: 'blessing',
  },
  tmux: {
    desc: 'Terminal multiplexer',
    homepage: 'https://tmux.github.io/',
    version: '3.8',
    dependencies: ['libevent', 'ncurses', 'utf8proc'],
    license: 'ISC',
  },
  xz: {
    desc: 'General-purpose data compression with high compression ratio',
    homepage: 'https://tukaani.org/xz/',
    version: '5.8.4',
    dependencies: [],
    license: '0BSD',
  },
};

/**
 * Fetches all releases from GitHub repository and maps them by formula name.
 * Format of release tags in Jaewoook/homebrew-nal: `<formula>.<version_and_revision>`
 * E.g. "ffmpeg.9.0.2_1", "tmux.3.8", "coreutils.9.12"
 */
export async function fetchReleasesMap(
  owner = GITHUB_REPO_OWNER,
  repo = GITHUB_REPO_NAME
): Promise<Record<string, FormulaRelease>> {
  const releaseMap: Record<string, FormulaRelease> = {};

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
      headers,
    });

    if (!res.ok) {
      console.warn(`GitHub Releases API returned ${res.status}: ${res.statusText}`);
      throw new Error(`GitHub Releases API returned ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return releaseMap;
    }

    for (const r of data) {
      const match = r.tag_name?.match(/^([a-z0-9_-]+?)\.([0-9].*)$/);
      const formulaName = match ? match[1] : r.tag_name;
      const releaseVersion = match ? match[2] : '';

      // Find bottle asset (.tar.gz or .bottle.)
      let bottleAsset: BottleAsset | undefined;
      if (Array.isArray(r.assets)) {
        const asset = r.assets.find(
          (a: any) => typeof a.name === 'string' && (a.name.endsWith('.tar.gz') || a.name.includes('.bottle.'))
        );

        if (asset) {
          const platformMatch = asset.name.match(/\.([a-zA-Z0-9_]+)\.bottle\./);
          const rebuildMatch = asset.name.match(/\.bottle\.([0-9]+)\.tar\.gz/);

          bottleAsset = {
            name: asset.name,
            size: typeof asset.size === 'number' ? asset.size : 0,
            downloadUrl: asset.browser_download_url || '',
            platform: platformMatch ? platformMatch[1] : undefined,
            rebuild: rebuildMatch ? parseInt(rebuildMatch[1], 10) : undefined,
            digest: asset.digest,
          };
        }
      }

      releaseMap[formulaName] = {
        tagName: r.tag_name,
        version: releaseVersion || r.tag_name,
        htmlUrl: r.html_url,
        publishedAt: r.published_at,
        bottleAsset,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch GitHub releases map:', err);
    throw err;
  }

  return releaseMap;
}

/**
 * Discover formulas from local clone if present
 */
function loadFormulasFromLocalTap(): Formula[] {
  if (process.env.NODE_ENV === 'test' && !process.env.LOCAL_TAP_PATH) {
    return [];
  }

  const possiblePaths = [
    process.env.LOCAL_TAP_PATH,
    path.resolve(process.cwd(), '../homebrew-nal'),
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    try {
      const formulaDir = path.join(p, 'Formula');
      if (fs.existsSync(formulaDir)) {
        const files = fs.readdirSync(formulaDir).filter((f) => f.endsWith('.rb'));
        if (files.length > 0) {
          const formulas: Formula[] = [];
          for (const file of files) {
            const name = file.replace(/\.rb$/, '');
            const content = fs.readFileSync(path.join(formulaDir, file), 'utf-8');
            formulas.push(parseFormulaRuby(name, content));
          }
          return formulas;
        }
      }
    } catch {
      // Continue to next path or fallback
    }
  }

  return [];
}

export async function getFormulaCatalog(forceRefresh = false): Promise<FormulaCatalog> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.timestamp < CACHE_TTL_SECONDS * 1000) {
    return catalogCache.data;
  }

  const formulas: Formula[] = [];
  let releasesMap: Record<string, FormulaRelease> = {};
  let fetchFailed = false;

  // 1. Fetch live releases from Jaewoook/homebrew-nal
  try {
    releasesMap = await fetchReleasesMap(GITHUB_REPO_OWNER, GITHUB_REPO_NAME);
  } catch {
    fetchFailed = true;
  }

  // 2. Discover formulas from local tap if available
  const localFormulas = loadFormulasFromLocalTap();
  if (localFormulas.length > 0) {
    formulas.push(...localFormulas);
  } else {
    // 3. Try GitHub Contents API
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
      }

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
            formulas.push(parseFormulaRuby(name, content));
          }
        }
      } else if (res.status === 403 || res.status === 429) {
        fetchFailed = true;
      }
    } catch {
      fetchFailed = true;
    }
  }

  // If fetch failed but we have an existing cache, preserve and return it (stale-while-revalidate)
  if (fetchFailed && catalogCache) {
    console.info('Serving existing formula cache due to GitHub API error.');
    return catalogCache.data;
  }

  // 4. Fallback to built-in 21 formulas if no formulas were fetched
  if (formulas.length === 0) {
    for (const [name, meta] of Object.entries(FALLBACK_FORMULAS)) {
      const fullVersion = meta.revision && meta.revision > 0 ? `${meta.version}_${meta.revision}` : meta.version;
      formulas.push({
        name,
        version: meta.version,
        revision: meta.revision,
        fullVersion,
        desc: meta.desc,
        homepage: meta.homepage,
        license: meta.license,
        dependencies: meta.dependencies,
        hasBottle: true,
      });
    }
  }

  // 5. Decorate formulas with release metadata & upstream versions in parallel
  await Promise.all(
    formulas.map(async (formula) => {
      const rel = releasesMap[formula.name];
      if (rel) {
        formula.release = rel;
        formula.releaseTag = rel.tagName;
        formula.releaseUrl = rel.htmlUrl;
        formula.publishedAt = rel.publishedAt;

        if (rel.bottleAsset) {
          formula.hasBottle = true;
          formula.bottleUrl = rel.bottleAsset.downloadUrl;
          formula.bottleFilename = rel.bottleAsset.name;
          formula.bottleSize = rel.bottleAsset.size;
          formula.bottlePlatform = rel.bottleAsset.platform;
        }

        if (rel.version) {
          formula.fullVersion = rel.version;
        }
      }

      try {
        const upstream = await checkUpstreamVersion(formula.name);
        formula.upstreamVersion = upstream;
        formula.hasUpdate = Boolean(upstream && upstream !== formula.version);
      } catch {
        // Upstream check is non-fatal
      }
    })
  );

  const catalog: FormulaCatalog = {
    formulas,
    total: formulas.length,
    lastUpdated: new Date().toISOString(),
  };

  catalogCache = { data: catalog, timestamp: now };
  return catalog;
}
