// app/components/InfoTooltip.tsx
'use client';

import { useState } from 'react';

interface InfoTooltipProps {
  formula?: string;
  window?: string;
  className?: string;
}

export default function InfoTooltip({ formula, window, className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!formula && !window) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-full"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="Show formula and window information"
      >
        ⓘ
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 max-w-xs">
          {formula && (
            <div className="mb-1">
              <span className="font-medium">Formula:</span> {formula}
            </div>
          )}
          {window && (
            <div>
              <span className="font-medium">Window:</span> {window}
            </div>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
