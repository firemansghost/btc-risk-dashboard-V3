import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alerts — Market Event Notifications | GhostGauge',
  description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
  openGraph: {
    title: 'Alerts — Market Event Notifications',
    description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
    url: 'https://ghostgauge.com/alerts',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Alerts — Market Event Notifications',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'Alerts — Market Event Notifications',
    description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
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
