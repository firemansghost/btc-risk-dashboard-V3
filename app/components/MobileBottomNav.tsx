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
    <nav className={`mobile-nav w-full max-w-[100vw] overflow-hidden ${className}`}>
      <div className="flex w-full min-w-0">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item flex-1 min-w-0 ${
              pathname === item.href ? 'mobile-nav-item-active' : ''
            }`}
          >
            <span className="text-lg mb-1 shrink-0">{item.icon}</span>
            <span className="truncate max-w-full text-[10px] leading-tight sm:text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
