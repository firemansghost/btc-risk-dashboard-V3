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
    { href: '/what-is-risk', label: 'What Is Risk?' },
  ];

  if (!mounted) {
    return (
      <nav className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 text-sm font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="mb-6">
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
