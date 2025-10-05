'use client';

import { ReactNode } from 'react';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export default function DashboardSection({
  title,
  subtitle,
  children,
  actions,
  className = '',
  headerClassName = '',
  contentClassName = ''
}: DashboardSectionProps) {
  return (
    <section className={`dashboard-section ${className}`}>
      <div className={`dashboard-section-header ${headerClassName}`}>
        <div>
          <h2 className="dashboard-section-title">{title}</h2>
          {subtitle && (
            <p className="dashboard-section-subtitle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="dashboard-section-actions">
            {actions}
          </div>
        )}
      </div>
      
      <div className={`dashboard-section-content ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
