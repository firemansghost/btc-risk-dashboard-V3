'use client';

import { useState, ReactNode } from 'react';

interface ProgressiveDisclosureProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: string;
  badge?: string | number;
  className?: string;
  summary?: string;
}

export default function ProgressiveDisclosure({
  title,
  children,
  defaultOpen = false,
  icon,
  badge,
  className = '',
  summary
}: ProgressiveDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`progressive-disclosure ${className}`}>
      <button
        onClick={toggle}
        className="progressive-disclosure-trigger"
        aria-expanded={isOpen}
        aria-controls={`progressive-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center space-x-3">
          {icon && <span className="text-lg">{icon}</span>}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {summary && (
              <p className="text-sm text-gray-600 mt-1">{summary}</p>
            )}
          </div>
          {badge && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div
        id={`progressive-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`progressive-disclosure-content ${
          isOpen ? 'progressive-disclosure-expanded' : 'progressive-disclosure-collapsed'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
