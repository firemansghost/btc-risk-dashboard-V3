import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sats Lens — Satoshis per Dollar Analysis | GhostGauge',
  description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
  openGraph: {
    title: 'Sats Lens — Satoshis per Dollar Analysis',
    description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
    url: 'https://ghostgauge.com/sats',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Sats Lens — Satoshis per Dollar Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'Sats Lens — Satoshis per Dollar Analysis',
    description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
    images: ['/og-default.png'],
  },
};

export default function SatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
