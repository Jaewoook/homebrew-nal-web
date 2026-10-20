import { Formula } from '@/types/formula';

export function parseFormulaRuby(name: string, content: string): Formula {
  const descMatch = content.match(/desc\s+["'](.*?)["']/);
  const homepageMatch = content.match(/homepage\s+["'](.*?)["']/);
  const urlMatch = content.match(/url\s+["'](.*?)["']/);
  const licenseMatch = content.match(/license\s+["'](.*?)["']/);

  // Explicit version
  const explicitVersionMatch = content.match(/version\s+["'](.*?)["']/);

  let version = explicitVersionMatch ? explicitVersionMatch[1] : '';

  // Extract from url if explicit version is absent
  if (!version && urlMatch) {
    const url = urlMatch[1];
    const tagMatch = url.match(/\/v?([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)(?:\.tar\.gz|\.tgz|\.zip|\/archive)/);
    if (tagMatch) {
      version = tagMatch[1];
    } else {
      const genericVersionMatch = url.match(/([0-9]+\.[0-9]+(?:\.[0-9a-zA-Z_\-]+)?)/);
      if (genericVersionMatch) {
        version = genericVersionMatch[1];
      }
    }
  }

  // Dependencies: depends_on "package"
  const dependencies: string[] = [];
  const depMatches = content.matchAll(/depends_on\s+["'](.*?)["']/g);
  for (const m of depMatches) {
    dependencies.push(m[1]);
  }

  // Bottle block presence
  const hasBottle = /bottle\s+do[\s\S]*?end/.test(content);

  return {
    name,
    version: version || 'unknown',
    desc: descMatch ? descMatch[1] : '',
    homepage: homepageMatch ? homepageMatch[1] : undefined,
    url: urlMatch ? urlMatch[1] : undefined,
    license: licenseMatch ? licenseMatch[1] : undefined,
    dependencies,
    hasBottle,
  };
}
