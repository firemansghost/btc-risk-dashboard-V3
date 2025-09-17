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
  description: 'Daily, transparent, factor-weighted risk for BTC. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
  metadataBase: new URL('https://ghostgauge.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'GhostGauge — Bitcoin G-Score',
    description: 'Daily, transparent, factor-weighted risk for BTC. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
    url: 'https://ghostgauge.com',
    siteName: 'GhostGauge',
    images: [
      {
        url: '/og-default.png',
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
    title: 'GhostGauge — Bitcoin G-Score',
    description: 'Daily, transparent, factor-weighted risk for BTC. Liquidity, momentum, term structure, macro, social. Signals, not hype.',
    images: ['/og-default.png'],
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
  return (
    <html lang="en" className={inter.variable}>
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
