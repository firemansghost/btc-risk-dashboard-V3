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
    <div className="glass-modal-backdrop fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal>
      <div className="glass-modal w-full max-w-2xl rounded-xl shadow-lg p-4">
        <div className="glass-sm flex items-center justify-between mb-3 p-3 rounded-lg">
          <h2 className="text-lg font-semibold">Provenance</h2>
          <button 
            className="glass-sm text-gray-400 hover:text-gray-600 hover:glass-hover transition-all duration-200 p-1 rounded" 
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
            <div key={i} className="glass-sm text-sm border border-white/20 rounded-lg p-3 flex items-start justify-between hover:glass-hover transition-all duration-200">
              <div className="pr-3">
                <div className="truncate max-w-[36rem]">{mask(r.url)}</div>
                {r.note && <div className="text-xs opacity-70">{r.note}</div>}
                {r.error && <div className="text-xs text-rose-500">{String(r.error).slice(0,200)}</div>}
              </div>
              <div className="text-right min-w-[6rem]">
                <div className={`glass-sm inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                  r.ok ? 'glass-green text-green-600 border-green-500/20' : 'glass-red text-red-600 border-red-500/20'
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
