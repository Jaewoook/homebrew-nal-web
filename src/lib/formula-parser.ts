import { Formula } from '@/types/formula';

export function parseFormulaRuby(name: string, content: string): Formula {
  const descMatch = content.match(/desc\s+["'](.*?)["']/);
  const homepageMatch = content.match(/homepage\s+["'](.*?)["']/);
  const urlMatch = content.match(/url\s+["'](.*?)["']/);
  const licenseMatch = content.match(/license\s+["'](.*?)["']/);

  // Explicit revision
  const revisionMatch = content.match(/revision\s+([0-9]+)/);
  const revision = revisionMatch ? parseInt(revisionMatch[1], 10) : undefined;

  // Explicit version
  const explicitVersionMatch = content.match(/version\s+["'](.*?)["']/);

  let version = explicitVersionMatch ? explicitVersionMatch[1] : '';

  // Extract from url if explicit version is absent
  if (!version && urlMatch) {
    const rawUrl = urlMatch[1];
    // Strip query strings or hash
    const url = rawUrl.split(/[?#]/)[0];
    const tagMatch = url.match(/\/v?([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)(?:\.tar\.(?:gz|xz|bz2|zst)|\.tgz|\.tbz|\.zip|\/archive)/i);
    if (tagMatch) {
      version = tagMatch[1];
    } else {
      // Remove archive extensions first before generic version matching
      const cleanUrl = url.replace(/(?:\.tar\.(?:gz|xz|bz2|zst)|\.tar|\.tgz|\.tbz|\.zip|\.7z)$/i, '');
      const genericVersionMatch = cleanUrl.match(/[-_./]v?([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)$/);
      if (genericVersionMatch) {
        version = genericVersionMatch[1];
      } else {
        const fallbackMatch = cleanUrl.match(/([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)/);
        if (fallbackMatch) {
          version = fallbackMatch[1].replace(/\.tar$/i, '');
        }
      }
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
