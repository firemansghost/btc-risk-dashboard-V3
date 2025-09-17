import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer — Legal Information | GhostGauge',
  description: 'Legal disclaimer for GhostGauge Bitcoin Risk Dashboard. Information provided for educational purposes only, not investment advice.',
  openGraph: {
    title: 'Disclaimer — Legal Information',
    description: 'Legal disclaimer for GhostGauge Bitcoin Risk Dashboard. Information provided for educational purposes only, not investment advice.',
    url: 'https://ghostgauge.com/disclaimer',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Disclaimer — Legal Information',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'Disclaimer — Legal Information',
    description: 'Legal disclaimer for GhostGauge Bitcoin Risk Dashboard. Information provided for educational purposes only, not investment advice.',
    images: ['/og-default.png'],
  },
};

export default function DisclaimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
