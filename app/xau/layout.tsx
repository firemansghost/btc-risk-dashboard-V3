import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis | GhostGauge',
  description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
  openGraph: {
    title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis',
    description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
    url: 'https://ghostgauge.com/xau',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'XAU Lens — BTC⇄Gold Cross-Asset Analysis',
    description: 'Bitcoin price in relation to gold. Daily BTC⇄Gold ratios with historical context and methodology.',
    images: ['/og-default.png'],
  },
};

export default function XauLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
