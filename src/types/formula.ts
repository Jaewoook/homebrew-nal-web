export interface BottleAsset {
  name: string;
  size: number;
  downloadUrl: string;
  platform?: string;
  rebuild?: number;
  digest?: string;
}

export interface FormulaRelease {
  tagName: string;
  version: string;
  htmlUrl: string;
  publishedAt: string;
  bottleAsset?: BottleAsset;
}

export interface Formula {
  name: string;
  version: string;
  revision?: number;
  fullVersion?: string; // e.g. "9.0.2_1" or "3.8"
  desc: string;
  homepage?: string;
  url?: string;
  license?: string;
  dependencies: string[];
  hasBottle: boolean;
  bottlePlatforms?: string[];
  upstreamVersion?: string | null;
  hasUpdate?: boolean;

  // Release properties for quick UI access
  releaseTag?: string;
  releaseUrl?: string;
  bottleUrl?: string;
  bottleFilename?: string;
  bottleSize?: number;
  bottlePlatform?: string;
  publishedAt?: string;
  release?: FormulaRelease;
}

export interface FormulaCatalog {
  formulas: Formula[];
  total: number;
  lastUpdated: string;
}
