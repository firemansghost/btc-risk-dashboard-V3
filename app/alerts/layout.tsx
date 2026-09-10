import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alerts — Current ETL Event Output | GhostGauge',
  description:
    'Current event output from the latest available GhostGauge production ETL. Not a complete historical alert ledger.',
  openGraph: {
    title: 'Alerts — Current ETL Event Output | GhostGauge',
    description:
      'Current event output from the latest available GhostGauge production ETL. Not a complete historical alert ledger.',
    url: 'https://ghostgauge.com/alerts',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Alerts — Current ETL Event Output',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'Alerts — Current ETL Event Output | GhostGauge',
    description:
      'Current event output from the latest available GhostGauge production ETL. Not a complete historical alert ledger.',
    images: ['/og-default.png'],
  },
};

export default function AlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
