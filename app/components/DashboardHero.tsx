'use client';

import { useState } from 'react';

interface DashboardHeroProps {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
    icon?: string;
  }>;
  className?: string;
}

export default function DashboardHero({
  title,
  subtitle,
  badge,
  actions = [],
  className = ''
}: DashboardHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={`hero-section ${className}`}>
      <div className="hero-content">
        {badge && (
          <div className="hero-badge">
            {badge}
          </div>
        )}
        
        <h1 className="hero-title">
          {title}
        </h1>
        
        <p className="hero-subtitle">
          {subtitle}
        </p>
        
        {actions.length > 0 && (
          <div className="hero-actions">
            {actions.map((action, index) => (
              <a
                key={index}
                href={action.href}
                onClick={action.onClick}
                className={`btn btn-lg ${
                  action.variant === 'primary' 
                    ? 'btn-primary' 
                    : 'btn-secondary'
                }`}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </a>
            ))}
          </div>
        )}
      </div>
      
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100 rounded-full opacity-20 transform translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-100 rounded-full opacity-20 transform -translate-x-16 translate-y-16"></div>
      </div>
    </section>
  );
}
