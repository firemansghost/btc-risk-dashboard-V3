'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileBottomNavProps {
  className?: string;
}

export default function MobileBottomNav({ className = '' }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Overview', icon: '📊' },
    { href: '/methodology', label: 'Method', icon: '📋' },
    { href: '/strategy-analysis', label: 'Strategy', icon: '📈' },
    { href: '/etf-predictions', label: 'ETF', icon: '💰' },
    { href: '/alerts', label: 'Alerts', icon: '🔔' },
  ];

  return (
    <nav className={`mobile-nav ${className}`}>
      <div className="flex justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item ${
              pathname === item.href ? 'mobile-nav-item-active' : ''
            }`}
          >
            <span className="text-lg mb-1">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
