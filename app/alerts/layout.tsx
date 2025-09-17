import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alerts — Market Event Notifications | GhostGauge',
  description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
  openGraph: {
    title: 'Alerts — Market Event Notifications',
    description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
    url: 'https://ghostgauge.com/alerts',
  },
  twitter: {
    title: 'Alerts — Market Event Notifications',
    description: 'Historical record of significant market events: ETF zero-cross detection and risk band changes.',
  },
};

export default function AlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
