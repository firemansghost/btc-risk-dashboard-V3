'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/methodology', label: 'Methodology' },
    { href: '/strategy-analysis', label: 'Strategy Analysis' },
    { href: '/etf-predictions', label: 'ETF Predictions' },
    { href: '/alerts', label: 'Alerts' },
    { href: '/what-is-risk', label: 'What Is Risk?' },
  ];

  if (!mounted) {
    return (
      <nav className="mb-4 sm:mb-6">
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50 min-w-0 flex-shrink-0"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="mb-4 sm:mb-6">
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors min-w-0 flex-shrink-0 ${
              pathname === item.href
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
