import { describe, it, expect } from 'vitest';
import { parseFormulaRuby, parseCaskRuby } from '@/lib/formula-parser';

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

  it('extracts version from url ending in .tar.xz without including .tar', () => {
    const rb = `
      class Coreutils < Formula
        desc "GNU File, Shell, and Text utilities"
        url "https://ftpmirror.gnu.org/coreutils/coreutils-9.12.tar.xz"
      end
    `;
    const formula = parseFormulaRuby('coreutils', rb);
    expect(formula.version).toBe('9.12');
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

  it('extracts cask metadata and mirrored binary state from ruby cask file', () => {
    const ghosttyCaskRb = `
      cask "ghostty" do
        version "1.1.2"
        sha256 "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

        url "https://github.com/Jaewoook/homebrew-nal/releases/download/cask-ghostty.1.1.2/Ghostty.dmg"
        name "Ghostty"
        desc "Terminal emulator that uses platform-native UI and GPU acceleration"
        homepage "https://ghostty.org/"

        app "Ghostty.app"
      end
    `;

    const cask = parseCaskRuby('ghostty.rb', ghosttyCaskRb);
    expect(cask.name).toBe('ghostty');
    expect(cask.packageType).toBe('cask');
    expect(cask.version).toBe('1.1.2');
    expect(cask.fullVersion).toBe('1.1.2');
    expect(cask.desc).toBe('Terminal emulator that uses platform-native UI and GPU acceleration');
    expect(cask.homepage).toBe('https://ghostty.org/');
    expect(cask.hasBottle).toBe(true);
    expect(cask.dependencies).toEqual([]);
  });

  it('correctly parses multi-arch cask where on_arm precedes on_intel', () => {
    const multiArchCaskRb = `
      cask "docker" do
        version "4.35.0"
        on_arm do
          sha256 "1111111111111111111111111111111111111111111111111111111111111111"
          url "https://desktop.docker.com/mac/main/arm64/Docker.dmg"
        end
        on_intel do
          sha256 "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
          url "https://github.com/Jaewoook/homebrew-nal/releases/download/cask-docker.4.35.0/docker-4.35.0-amd64.dmg"
        end
        name "Docker"
        desc "App to build and share containerized apps"
        homepage "https://www.docker.com/products/docker-desktop/"
        app "Docker.app"
      end
    `;

    const cask = parseCaskRuby('docker', multiArchCaskRb);
    expect(cask.name).toBe('docker');
    expect(cask.packageType).toBe('cask');
    expect(cask.version).toBe('4.35.0');
    expect(cask.hasBottle).toBe(true);
    expect(cask.bottlePlatforms).toEqual(['x86_64']);
    expect(cask.url).toBe(
      'https://github.com/Jaewoook/homebrew-nal/releases/download/cask-docker.4.35.0/docker-4.35.0-amd64.dmg'
    );
  });
});
