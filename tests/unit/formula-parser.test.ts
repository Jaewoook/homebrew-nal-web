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

  it('parses revision and constructs fullVersion with revision suffix', () => {
    const ffmpegRb = `
      class Ffmpeg < Formula
        desc "Play, record, convert, and stream select audio and video codecs"
        homepage "https://ffmpeg.org/"
        url "https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz"
        license "GPL-3.0-or-later"
        revision 1

        bottle do
          root_url "https://github.com/Jaewoook/homebrew-nal/releases/download/ffmpeg.9.0.2_1"
          rebuild 1
          sha256 sequoia: "5afb7967a84db5ccc3d4a8e0ac2cb7aa3db0408e5b6dece5cefc9aeaa55b86f1"
        end
      end
    `;

    const formula = parseFormulaRuby('ffmpeg', ffmpegRb);
    expect(formula.name).toBe('ffmpeg');
    expect(formula.version).toBe('9.0.2');
    expect(formula.revision).toBe(1);
    expect(formula.fullVersion).toBe('9.0.2_1');
    expect(formula.hasBottle).toBe(true);
    expect(formula.bottlePlatforms).toContain('sequoia');
  });
});
