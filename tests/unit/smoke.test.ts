import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('Project Scaffold Smoke Test', () => {
  it('verifies testing environment is functional', () => {
    expect(true).toBe(true);
  });

  it('includes Content-Security-Policy in Next.js security headers', async () => {
    const headerRules = await nextConfig.headers!();
    const globalHeaders = headerRules[0].headers;
    const cspHeader = globalHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(cspHeader).toBeDefined();
    expect(cspHeader?.value).toContain("default-src 'self'");
    expect(cspHeader?.value).toContain("frame-ancestors 'none'");
  });
});
