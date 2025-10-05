'use client';

interface QuickAction {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
  className?: string;
  compact?: boolean;
}

export default function QuickActions({
  actions,
  title = 'Quick Actions',
  className = '',
  compact = false
}: QuickActionsProps) {
  return (
    <div className={`quick-actions ${compact ? 'p-3' : 'p-4'} ${className}`}>
      {title && (
        <div className="w-full mb-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
      )}
      
      <div className={`flex ${compact ? 'flex-col space-y-2' : 'flex-wrap gap-3'}`}>
        {actions.map((action, index) => {
          const baseClasses = `quick-action ${
            action.variant === 'primary' 
              ? 'quick-action-primary' 
              : action.variant === 'secondary'
              ? 'quick-action-secondary'
              : ''
          }`;
          
          const disabledClasses = action.disabled 
            ? 'opacity-50 cursor-not-allowed pointer-events-none' 
            : '';

          if (action.href) {
            return (
              <a
                key={index}
                href={action.href}
                className={`${baseClasses} ${disabledClasses}`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </a>
            );
          }

          return (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`${baseClasses} ${disabledClasses}`}
            >
              <span className="mr-2">{action.icon}</span>
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
