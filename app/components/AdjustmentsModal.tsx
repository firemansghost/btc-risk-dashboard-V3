'use client';

import { useEffect } from 'react';

type CycleAdj = { adj_pts: number; residual_z: number | null; last_utc: string | null; source: string | null; reason?: string };
type SpikeAdj = { adj_pts: number; r_1d: number; sigma: number; z: number; ref_close: number; spot: number; last_utc: string; source: string; reason?: string };

export interface AdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle?: CycleAdj | null;
  spike?: SpikeAdj | null;
  latestIso?: string | null;
}

export default function AdjustmentsModal({ isOpen, onClose, cycle, spike, latestIso }: AdjustmentsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Score Adjustments</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <p className="text-sm text-gray-600 mb-4">Diagnostics for cycle and spike adjustments. As of {latestIso ? new Date(latestIso).toLocaleString() : '—'}.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Cycle Adjustment</h3>
            {cycle ? (
              <div className="text-sm text-gray-700 space-y-1">
                <div><span className="text-gray-500">adj_pts:</span> <span className="font-medium">{cycle.adj_pts}</span></div>
                <div><span className="text-gray-500">residual_z:</span> <span className="font-medium">{cycle.residual_z ?? '—'}</span></div>
                <div><span className="text-gray-500">last_utc:</span> <span className="font-medium">{cycle.last_utc ?? '—'}</span></div>
                <div><span className="text-gray-500">source:</span> <span className="font-medium">{cycle.source ?? '—'}</span></div>
                {cycle.reason && <div className="text-xs text-gray-500">{cycle.reason}</div>}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </div>

          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Spike Adjustment</h3>
            {spike ? (
              <div className="text-sm text-gray-700 space-y-1">
                <div><span className="text-gray-500">adj_pts:</span> <span className="font-medium">{spike.adj_pts}</span></div>
                <div><span className="text-gray-500">r_1d:</span> <span className="font-medium">{spike.r_1d}</span></div>
                <div><span className="text-gray-500">sigma:</span> <span className="font-medium">{spike.sigma}</span></div>
                <div><span className="text-gray-500">z:</span> <span className="font-medium">{spike.z}</span></div>
                <div><span className="text-gray-500">ref_close:</span> <span className="font-medium">{spike.ref_close}</span></div>
                <div><span className="text-gray-500">spot:</span> <span className="font-medium">{spike.spot}</span></div>
                <div><span className="text-gray-500">last_utc:</span> <span className="font-medium">{spike.last_utc}</span></div>
                <div><span className="text-gray-500">source:</span> <span className="font-medium">{spike.source}</span></div>
                {spike.reason && <div className="text-xs text-gray-500">{spike.reason}</div>}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">Close</button>
        </div>
      </div>
    </div>
  );
}


