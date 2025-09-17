'use client';

import { useState, useEffect } from 'react';

export default function BrandPage() {
  const [brandContent, setBrandContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the brand card content from the docs
    fetch('/docs/BRAND_CARD.md', { cache: 'no-store' })
      .then(response => response.text())
      .then(content => {
        setBrandContent(content);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading brand card:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="prose prose-gray max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {brandContent}
        </div>
      </div>
    </div>
  );
}
