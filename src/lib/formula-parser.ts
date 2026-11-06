import { Formula } from '@/types/formula';

export function parseFormulaRuby(name: string, content: string): Formula {
  // 1. Remove fails_with blocks so compiler versions (e.g. version "11") are ignored
  const cleanContent = content.replace(/fails_with\s+:[a-zA-Z0-9_]+\s+do[\s\S]*?end/g, '');

  const descMatch = cleanContent.match(/desc\s+["'](.*?)["']/);
  const homepageMatch = cleanContent.match(/homepage\s+["'](.*?)["']/);
  const licenseMatch = cleanContent.match(/license\s+["'](.*?)["']/);

  // Explicit revision
  const revisionMatch = cleanContent.match(/^\s*revision\s+([0-9]+)/m);
  const revision = revisionMatch ? parseInt(revisionMatch[1], 10) : undefined;

  // Explicit version (anchored to prevent matching in nested helper blocks)
  const explicitVersionMatch = cleanContent.match(/^\s*version\s+["'](.*?)["']/m);
  let version = explicitVersionMatch ? explicitVersionMatch[1] : '';

  const urlMatch = cleanContent.match(/^\s*url\s+["'](.*?)["']/m);

  // Extract from primary url if explicit version is absent
  if (!version && urlMatch) {
    const rawUrl = urlMatch[1].split(/[?#]/)[0];
    const filename = rawUrl.split('/').pop() || '';
    const base = filename
      .replace(/(?:\.tar\.(?:gz|xz|bz2|zst)|\.tar|\.tgz|\.tbz|\.zip|\.7z|\.pem)$/i, '')
      .replace(/[-.]src$/i, '');

    const m = base.match(
      /(?:^|[a-zA-Z_-]+|\/tags\/v?)([0-9]+(?:\.[0-9]+)+|[0-9]{4,}(?:-[0-9]{2}-[0-9]{2})?|[0-9]{8,}(?:\.[0-9]+)?)$/
    );
    if (m) {
      version = m[1];
    } else {
      // Version may be in the directory segment (e.g. .../v2.9.8/deno_src.tar.gz)
      const dirSegments = rawUrl.split('/');
      for (let i = dirSegments.length - 2; i >= 0; i--) {
        const seg = dirSegments[i];
        const segMatch = seg.match(/^v?([0-9]+(?:\.[0-9]+)+)$/);
        if (segMatch) {
          version = segMatch[1];
          break;
        }
      }
    }
  }

  // Fallback to bottle root_url (e.g. .../releases/download/<name>.<version>)
  if (!version) {
    const rootUrlMatch = cleanContent.match(
      /root_url\s+["'].*?\/releases\/download\/[a-zA-Z0-9_@+-]+?\.([0-9]+(?:\.[0-9a-zA-Z._+-]+)*)["']/
    );
    if (rootUrlMatch) {
      version = rootUrlMatch[1];
    }
  }

  // Generic fallback if url exists but didn't match the specific patterns
  if (!version && urlMatch) {
    const cleanUrl = urlMatch[1]
      .split(/[?#]/)[0]
      .replace(/(?:\.tar\.(?:gz|xz|bz2|zst)|\.tar|\.tgz|\.tbz|\.zip|\.7z|\.pem)$/i, '');
    const genericMatch = cleanUrl.match(/([0-9]+(?:\.[0-9]+)+)/);
    if (genericMatch) {
      version = genericMatch[1];
    }
  }

  // Dependencies: depends_on "package"
  const dependencies: string[] = [];
  const depMatches = content.matchAll(/depends_on\s+["'](.*?)["']/g);
  for (const m of depMatches) {
    dependencies.push(m[1]);
  }

  // Bottle block presence & platforms
  const bottleBlockMatch = content.match(/bottle\s+do([\s\S]*?)end/);
  const hasBottle = Boolean(bottleBlockMatch);
  const bottlePlatforms: string[] = [];

  if (bottleBlockMatch) {
    const bottleBlock = bottleBlockMatch[1];
    const platformMatches = bottleBlock.matchAll(/sha256\s+([a-zA-Z0-9_]+):/g);
    for (const pm of platformMatches) {
      bottlePlatforms.push(pm[1]);
    }
  }

  const baseVersion = version || 'unknown';
  const fullVersion = revision && revision > 0 ? `${baseVersion}_${revision}` : baseVersion;

  return {
    name,
    packageType: 'formula',
    version: baseVersion,
    revision,
    fullVersion,
    desc: descMatch ? descMatch[1] : '',
    homepage: homepageMatch ? homepageMatch[1] : undefined,
    url: urlMatch ? urlMatch[1] : undefined,
    license: licenseMatch ? licenseMatch[1] : undefined,
    dependencies,
    hasBottle,
    bottlePlatforms: bottlePlatforms.length > 0 ? bottlePlatforms : undefined,
  };
}

export function parseCaskRuby(filenameOrName: string, content: string): Formula {
  const name = filenameOrName.replace(/\.rb$/, '');
  const descMatch = content.match(/desc\s+["'](.*?)["']/);
  const homepageMatch = content.match(/homepage\s+["'](.*?)["']/);
  const intelBlockMatch = content.match(/on_intel\s+do[\s\S]*?url\s+["'](.*?)["'][\s\S]*?end/);
  const urlMatch = intelBlockMatch || content.match(/url\s+["'](.*?)["']/);
  const versionMatch = content.match(/version\s+["'](.*?)["']/);

  const rawVersion = versionMatch ? versionMatch[1] : 'unknown';
  const version = rawVersion.split(',')[0] || 'unknown';
  const url = urlMatch ? urlMatch[1] : undefined;
  const isMirrored = Boolean(
    (url && url.includes('github.com/Jaewoook/homebrew-nal/releases/download/cask-')) ||
    content.includes('github.com/Jaewoook/homebrew-nal/releases/download/cask-')
  );

  return {
    name,
    packageType: 'cask',
    version,
    fullVersion: version,
    desc: descMatch ? descMatch[1] : '',
    homepage: homepageMatch ? homepageMatch[1] : undefined,
    url,
    dependencies: [],
    hasBottle: isMirrored,
    bottlePlatforms: isMirrored ? ['x86_64'] : undefined,
  };
}
