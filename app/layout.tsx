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
  title: 'Bitcoin Risk Dashboard',
  description: 'A simple, transparent BTC risk dashboard.',
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
