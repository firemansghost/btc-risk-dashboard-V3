'use client';

import { useEffect, useState } from 'react';

type Band = { key: string; label: string; range: [number, number]; color: string; recommendation: string };
type ApiConfig = { ok: boolean; config?: { bands: Band[] }; digest?: string };

function chipColor(color: string) {
  // map your semantic `color` to Tailwind pairs
  switch (color) {
    case 'green':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'blue':   return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'red':    return 'bg-rose-100 text-rose-800 border-rose-200';
    default:       return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export default function RiskBandLegend({ score }: { score: number }) {
  const [bands, setBands] = useState<Band[] | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        const json: ApiConfig = await res.json();
        if (!alive) return;
        if (json?.ok && json.config?.bands) {
          setBands(json.config.bands);
          setDigest(json.digest ?? null);
        }
      } catch (error) {
        console.warn('Failed to load risk bands:', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!bands) {
    return (
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const active = bands.find(b => score >= b.range[0] && score < b.range[1]) ?? bands[bands.length - 1];

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 sm:p-4">
      <p className="text-xs text-slate-500 mb-2">Bands apply to Bitcoin.</p>
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Risk Bands</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          {digest && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(digest);
                // Could add a toast notification here
              }}
              title="Click to copy config digest"
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              cfg {digest}
            </button>
          )}
          <a
            href="/methodology#bands"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Learn how bands work →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {bands.map(b => {
          const isActive = b.key === active.key;
          return (
            <div
              key={b.key}
              className={`flex flex-col sm:flex-row sm:items-start sm:justify-between rounded-lg border bg-white px-3 py-2 gap-2 ${
                isActive ? 'border-slate-400 shadow-sm' : 'border-slate-200'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${chipColor(b.color)}`}>
                    {b.label}
                  </span>
                  {isActive && <span className="text-[10px] font-medium text-slate-600">Current</span>}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Range <span className="font-mono">{b.range[0]}–{b.range[1]}</span>
                  <span className="mx-1">•</span>
                  <span className="text-slate-700">{b.recommendation}</span>
                </div>
              </div>
              <div className="pl-3 text-right">
                {isActive ? (
                  <div className="mt-0.5 rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                    {score}
                  </div>
                ) : (
                  <div className="mt-0.5 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Bands translate the 0–100 score into plain-English guidance. The composite is a weighted blend of factors; use
        <span className="mx-1 italic">Weights</span> to preview alternative blends.
      </p>
    </div>
  );
}
