'use client';

import { useState, useRef, useEffect } from 'react';

interface MobileCollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  icon?: string;
  badge?: string | number;
}

export default function MobileCollapsible({ 
  title, 
  children, 
  defaultOpen = false, 
  className = '',
  icon,
  badge
}: MobileCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`collapsible ${className}`}>
      <button
        onClick={toggle}
        className="collapsible-trigger"
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center space-x-3">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-left font-medium text-gray-900">{title}</span>
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
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`collapsible-content transition-all duration-300 ease-in-out ${
          isOpen ? 'collapsible-open' : 'collapsible-closed'
        }`}
        style={{ height: height !== undefined ? `${height}px` : undefined }}
        ref={contentRef}
      >
        {children}
      </div>
    </div>
  );
}
