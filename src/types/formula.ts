export interface Formula {
  name: string;
  version: string;
  desc: string;
  homepage?: string;
  url?: string;
  license?: string;
  dependencies: string[];
  hasBottle: boolean;
  upstreamVersion?: string | null;
  hasUpdate?: boolean;
}

export interface FormulaCatalog {
  formulas: Formula[];
  total: number;
  lastUpdated: string;
}
