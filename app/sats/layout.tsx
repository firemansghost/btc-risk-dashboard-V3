import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sats Lens — Satoshis per Dollar Analysis | GhostGauge',
  description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
  openGraph: {
    title: 'Sats Lens — Satoshis per Dollar Analysis',
    description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
    url: 'https://ghostgauge.com/sats',
  },
  twitter: {
    title: 'Sats Lens — Satoshis per Dollar Analysis',
    description: 'Bitcoin denominated in satoshis per dollar. Daily satoshi conversion rates with historical context.',
  },
};

export default function SatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
