'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  href: string;
  label: string;
  description: string;
  icon: string;
  category: string;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const searchData: SearchResult[] = [
    {
      href: '/',
      label: 'Overview',
      description: 'Main dashboard with G-Score and key metrics',
      icon: '📊',
      category: 'Dashboard'
    },
    {
      href: '/methodology',
      label: 'Methodology',
      description: 'How the G-Score is calculated and factor weights',
      icon: '📋',
      category: 'Documentation'
    },
    {
      href: '/strategy-analysis',
      label: 'Strategy Analysis',
      description: 'Trading strategies and risk analysis',
      icon: '📈',
      category: 'Analysis'
    },
    {
      href: '/etf-predictions',
      label: 'ETF Predictions',
      description: 'Bitcoin ETF flow predictions and forecasts',
      icon: '💰',
      category: 'Predictions'
    },
    {
      href: '/alerts',
      label: 'Alerts',
      description: 'Risk alerts and notifications',
      icon: '🔔',
      category: 'Alerts'
    },
    {
      href: '/what-is-risk',
      label: 'What Is Risk?',
      description: 'Understanding Bitcoin risk factors',
      icon: '❓',
      category: 'Education'
    }
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim()) {
      const filtered = searchData.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setSelectedIndex(0);
    } else {
      setResults(searchData);
      setSelectedIndex(0);
    }
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            window.location.href = results[selectedIndex].href;
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="search-modal-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="search-modal-container">
        <div className="search-modal-content">
          <div className="card-elevated card-lg bg-white">
            {/* Search Input */}
            <div className="p-6 border-b border-gray-200">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, features, and content..."
                  className="search-input"
                />
                <svg className="absolute left-4 top-4 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="search-results">
              {results.length > 0 ? (
                <div ref={resultsRef}>
                  {results.map((result, index) => (
                    <Link
                      key={result.href}
                      href={result.href}
                      onClick={onClose}
                      className={`search-result-item ${
                        index === selectedIndex ? 'search-result-item-selected' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="search-result-icon">{result.icon}</span>
                        <div className="search-result-content">
                          <div className="flex items-center space-x-2">
                            <h3 className="search-result-title">
                              {result.label}
                            </h3>
                            <span className="search-result-category">
                              {result.category}
                            </span>
                          </div>
                          <p className="search-result-description">
                            {result.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try searching for something else.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="search-footer">
              <div className="search-footer-help">
                <div className="search-footer-shortcuts">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                  <span>Esc Close</span>
                </div>
                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
