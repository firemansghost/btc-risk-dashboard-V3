'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import { analytics } from '@/lib/analytics';
import { getConfig } from '@/lib/riskConfig';

export default function Navigation() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { href: '/', label: 'Overview', icon: '📊' },
    { href: '/assets', label: 'Assets', icon: '🏛️' },
    { href: '/methodology', label: 'Methodology', icon: '📋' },
    { href: '/strategy-analysis', label: 'Strategy Analysis', icon: '📈' },
    { href: '/etf-predictions', label: 'ETF Predictions', icon: '💰' },
    { href: '/alerts', label: 'Alerts', icon: '🔔' },
    { href: '/what-is-risk', label: 'What Is Risk?', icon: '❓' },
  ];

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ href: '/', label: 'Home' }];
    
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const navItem = navItems.find(item => item.href === currentPath);
      breadcrumbs.push({
        href: currentPath,
        label: navItem?.label || segment.charAt(0).toUpperCase() + segment.slice(1)
      });
    });
    
    return breadcrumbs;
  };

  const handleSearchClick = () => {
    setShowSearchModal(true);
  };

  if (!mounted) {
    return (
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 mb-4 sm:mb-6">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-heading-2 text-emerald-600 font-bold">
                GhostGauge
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-sm font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      {/* Sticky Navigation */}
      <nav className={`glass-nav ${isScrolled ? 'glass-nav-sticky' : ''}`}>
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="text-heading-2 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
              GhostGauge
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 min-w-0 flex-shrink-0 ${
                    pathname === item.href
                      ? 'glass-blue text-blue-900 border border-blue-300/50'
                      : 'text-gray-600 hover:text-gray-900 hover:glass-hover'
                  }`}
                  onClick={() => {
                    if (item.href === '/assets') {
                      const config = getConfig();
                      analytics.assetsPageClicked(config.model_version || 'v1.1');
                    }
                  }}
                >
                  <span className="hidden lg:inline mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Search & Mobile Menu */}
            <div className="flex items-center space-x-2">
              {/* Search Button */}
              <button
                onClick={handleSearchClick}
                className="glass-sm p-2 text-gray-500 hover:text-gray-700 hover:glass-hover rounded-md transition-all duration-200"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="glass-sm md:hidden p-2 text-gray-500 hover:text-gray-700 hover:glass-hover rounded-md transition-all duration-200"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>


          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="glass-sm nav-mobile-menu">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (item.href === '/assets') {
                      analytics.assetsPageClicked();
                    }
                  }}
                  className={`nav-mobile-item ${
                    pathname === item.href
                      ? 'glass-blue text-blue-900 border border-blue-300/50'
                      : 'text-gray-600 hover:text-gray-900 hover:glass-hover'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Search Modal */}
      <SearchModal 
        isOpen={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
      />

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <nav className="mb-4 sm:mb-6" aria-label="Breadcrumb">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ol className="glass-sm breadcrumb rounded-lg p-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center">
                  {index > 0 && (
                    <svg className="breadcrumb-separator" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <Link
                    href={crumb.href}
                    className={`breadcrumb-item ${
                      index === breadcrumbs.length - 1 
                        ? 'glass-blue text-blue-900 border border-blue-300/50 px-2 py-1 rounded-md' 
                        : 'text-gray-600 hover:text-gray-900 hover:glass-hover px-2 py-1 rounded-md'
                    }`}
                  >
                    {crumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      )}
    </>
  );
}
