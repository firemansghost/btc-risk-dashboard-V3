'use client';

type ContextOnlyBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

/** Subtle pill for display-only context panels (not part of official G-Score). */
export default function ContextOnlyBadge({ children, className = '' }: ContextOnlyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-gray-600 ${className}`}
    >
      {children}
    </span>
  );
}
