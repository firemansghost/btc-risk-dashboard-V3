import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SiteFooter from './components/SiteFooter';
import Navigation from './components/Navigation';

const inter = Inter({ 
  subsets: ['latin'], 
  display: 'swap',
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'GhostGauge — Bitcoin G-Score (0–100 multi-factor market risk)',
  description: 'Daily, transparent, factor-weighted risk for Bitcoin. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
  metadataBase: new URL('https://ghostgauge.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'GhostGauge — Bitcoin G-Score',
    description: 'Daily, transparent, factor-weighted risk for Bitcoin. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
    url: 'https://ghostgauge.com',
    siteName: 'GhostGauge',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'GhostGauge — Bitcoin G-Score',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@grayghost',
    title: 'GhostGauge — Bitcoin G-Score',
    description: 'Daily, transparent, factor-weighted risk for Bitcoin. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GhostGauge',
    description: 'Daily, transparent, factor-weighted risk for Bitcoin. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
    url: 'https://ghostgauge.com',
    logo: 'https://ghostgauge.com/og-default.png',
    founder: {
      '@type': 'Person',
      name: 'GrayGhost',
      sameAs: [
        'https://x.com/grayghost',
        'https://github.com/firemansghost'
      ]
    },
    sameAs: [
      'https://x.com/grayghost',
      'https://github.com/firemansghost/btc-risk-dashboard-V3'
    ]
  };

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <div className="container max-w-6xl mx-auto py-6">
          <Navigation />
          <main>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
