import { describe, it, expect } from 'vitest';
import { parseFormulaRuby } from '@/lib/formula-parser';

describe('Formula Ruby Parser', () => {
  const sampleRb = `
    class NalCore < Formula
      desc "NAL Core Homelab Daemon"
      homepage "https://nal.internal"
      url "https://github.com/Jaewoook/nal-core/archive/v1.4.2.tar.gz"
      license "MIT"

      depends_on "openssl@3"
      depends_on "curl"

      bottle do
        root_url "https://github.com/jaewoook/homebrew-nal/releases/download/bottles"
        sha256 arm64_sonoma: "abc12345"
      end
    end
  `;

  it('extracts formula metadata from ruby formula file', () => {
    const formula = parseFormulaRuby('nal-core', sampleRb);
    expect(formula.name).toBe('nal-core');
    expect(formula.version).toBe('1.4.2');
    expect(formula.desc).toBe('NAL Core Homelab Daemon');
    expect(formula.homepage).toBe('https://nal.internal');
    expect(formula.license).toBe('MIT');
    expect(formula.hasBottle).toBe(true);
    expect(formula.dependencies).toContain('openssl@3');
    expect(formula.dependencies).toContain('curl');
  });

  it('extracts version from url tag if explicit version is omitted', () => {
    const rbWithoutExplicitVersion = `
      class CustomTool < Formula
        desc "Custom homelab CLI tool"
        url "https://github.com/Jaewoook/custom-tool/archive/refs/tags/v2.3.1.tar.gz"
      end
    `;
    const formula = parseFormulaRuby('custom-tool', rbWithoutExplicitVersion);
    expect(formula.version).toBe('2.3.1');
  });
});
