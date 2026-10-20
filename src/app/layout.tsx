import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'jaewoook/homebrew-nal | NAL Homelab Tap',
  description: 'Formula registry, documentation, and build management for jaewoook/homebrew-nal tap.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f17] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
