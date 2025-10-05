'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import SkeletonLoader from './SkeletonLoader';

interface LazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  delay?: number;
}

export default function LazyLoader({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  className = '',
  delay = 0
}: LazyLoaderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          
          if (delay > 0) {
            setTimeout(() => {
              setIsLoaded(true);
            }, delay);
          } else {
            setIsLoaded(true);
          }
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [threshold, rootMargin, delay]);

  const defaultFallback = (
    <div className="lazy-load-hidden">
      <SkeletonLoader isLoading={true}>
        <div className="space-y-4">
          <div className="skeleton-title"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-text-sm"></div>
        </div>
      </SkeletonLoader>
    </div>
  );

  return (
    <div ref={elementRef} className={`lazy-load ${className}`}>
      {isVisible ? (
        <div className={`lazy-load-visible ${isLoaded ? 'progressive-enhancement-loaded' : 'progressive-enhancement-loading'}`}>
          {isLoaded ? children : (fallback || defaultFallback)}
        </div>
      ) : (
        fallback || defaultFallback
      )}
    </div>
  );
}
