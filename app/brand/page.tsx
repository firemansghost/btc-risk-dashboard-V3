'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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
      <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-li:text-gray-700 prose-li:leading-relaxed prose-blockquote:text-gray-600 prose-blockquote:border-l-gray-300 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200">
        <ReactMarkdown>{brandContent}</ReactMarkdown>
      </div>
    </div>
  );
}
