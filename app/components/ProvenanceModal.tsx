'use client';
import { useEffect } from 'react';

export default function ProvenanceModal({ open, onClose, items }: {
  open: boolean; 
  onClose: () => void;
  items: Array<{url: string; ok: boolean; status: number; ms: number; error?: string; note?: string}>;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  
  const mask = (u: string) => u.replace(/(api_key=)[^&]+/ig, '$1****');
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" role="dialog" aria-modal>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Provenance</h2>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors" 
            onClick={onClose} 
            aria-label="Close provenance"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {items.map((r, i) => (
            <div key={i} className="text-sm border rounded-lg p-2 flex items-start justify-between">
              <div className="pr-3">
                <div className="truncate max-w-[36rem]">{mask(r.url)}</div>
                {r.note && <div className="text-xs opacity-70">{r.note}</div>}
                {r.error && <div className="text-xs text-rose-500">{String(r.error).slice(0,200)}</div>}
              </div>
              <div className="text-right min-w-[6rem]">
                <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                  r.ok ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  {r.status} · {r.ms}ms
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
