import React from 'react';

type FactorDetail = { label: string; value: any };
type Factor = {
  key: string;
  label: string;
  weight_pct: number;
  score: number | null;
  status: 'fresh' | 'stale' | 'excluded';
  last_utc: string | null;
  source: string | null;
  details: FactorDetail[];
  reason?: string;
};

function StatusBadge({ status }: { status: Factor['status'] }) {
  const map: Record<Factor['status'], string> = {
    fresh: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    stale: 'bg-amber-50 text-amber-700 ring-amber-200',
    excluded: 'bg-neutral-100 text-neutral-600 ring-neutral-300',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${map[status]}`}>
      {status === 'fresh' ? 'fresh' : status === 'stale' ? 'stale' : 'excluded'}
    </span>
  );
}

export default function FactorCard({ factor }: { factor: Factor }) {
  const score = factor.score;
  return (
    <div className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">Weight {factor.weight_pct}%</div>
          <div className="text-lg font-medium">{factor.label}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={factor.status} />
          <div className="rounded-xl bg-neutral-900 px-3 py-1 text-lg font-semibold text-white tabular-nums">
            {typeof score === 'number' ? score : '—'}
          </div>
        </div>
      </div>

      <div className="text-sm text-neutral-600">
        <div className="mb-1">
          <span className="font-medium">Last:</span> {factor.last_utc ?? '—'}
        </div>
        <div className="mb-3">
          <span className="font-medium">Source:</span> {factor.source ?? '—'}
        </div>
      </div>

      <div className="grid gap-2">
        {factor.details?.map((d, i) => (
          <div key={i} className="flex justify-between text-sm text-neutral-800">
            <span className="text-neutral-500">{d.label}</span>
            <span className="font-medium">{String(d.value)}</span>
          </div>
        ))}
        {(!factor.details || factor.details.length === 0) && (
          <div className="text-sm text-neutral-500">No additional details.</div>
        )}
      </div>

      {factor.reason && factor.status === 'excluded' && (
        <div className="mt-3 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
          Excluded: <span className="font-medium">{factor.reason}</span>
        </div>
      )}
    </div>
  );
}
