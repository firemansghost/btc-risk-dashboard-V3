import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand Card — GhostGauge',
  description: 'GhostGauge brand guidelines, voice, naming conventions, and ready-to-use copy for consistent messaging.',
  openGraph: {
    title: 'Brand Card — GhostGauge',
    description: 'GhostGauge brand guidelines, voice, naming conventions, and ready-to-use copy for consistent messaging.',
    url: 'https://ghostgauge.com/brand',
    siteName: 'GhostGauge',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'GhostGauge Brand Card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'Brand Card — GhostGauge',
    description: 'GhostGauge brand guidelines, voice, naming conventions, and ready-to-use copy for consistent messaging.',
    images: ['/og-default.png'],
  },
  alternates: {
    canonical: 'https://ghostgauge.com/brand',
  },
};

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
