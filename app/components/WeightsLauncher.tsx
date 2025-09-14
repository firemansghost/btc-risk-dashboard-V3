'use client';
import { useEffect } from 'react';

type Props = {
  onOpen: () => void;
  size?: 'sm' | 'md';
  className?: string;
};

export default function WeightsLauncher({ onOpen, size = 'md', className }: Props) {
  // Keyboard shortcut: "w" to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Only trigger if not typing in an input field
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          onOpen();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);

  const base =
    'inline-flex items-center rounded-lg border border-slate-200/60 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition px-3 text-slate-800';
  const sizes = size === 'sm' ? 'h-8 text-sm' : 'h-9 text-sm';

  return (
    <button type="button" onClick={onOpen} className={`${base} ${sizes} ${className ?? ''}`}>
      Weights
      <kbd className="ml-2 rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">W</kbd>
    </button>
  );
}
