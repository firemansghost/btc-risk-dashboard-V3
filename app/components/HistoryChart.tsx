'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Point = {
  as_of_utc: string;
  composite: number;
  trendValuation?: number | null;
  netLiquidity?: number | null;
  stablecoins?: number | null;
  termLeverage?: number | null;
  onchain?: number | null;
  etfFlows?: number | null;
};

const ranges: Array<{ key: '30d'|'90d'|'180d'|'1y'; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '180D' },
  { key: '1y', label: '1Y' },
];

export default function HistoryChart() {
  const [range, setRange] = useState<'30d'|'90d'|'180d'|'1y'>('90d');
  const [data, setData] = useState<Point[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/api/history?range=${range}&ts=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? res.statusText);
        if (!alive) return;
        setData(json.points || []);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      }
    })();
    return () => { alive = false; };
  }, [range]);

  const pretty = useMemo(() =>
    (data || []).map(p => ({
      date: new Date(p.as_of_utc).toISOString().slice(0, 10),
      composite: p.composite,
    })), [data]);

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Risk History</div>
        <div className="flex gap-2">
          {ranges.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2 py-1 rounded text-sm border ${range === r.key ? 'bg-white text-black' : 'opacity-75'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {err && <div className="text-sm text-red-500">Error: {err}</div>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pretty}>
            <defs>
              <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.35}/>
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4}/>
            <XAxis dataKey="date" minTickGap={24}/>
            <YAxis domain={[0, 100]}/>
            <Tooltip />
            <Area type="monotone" dataKey="composite" stroke="currentColor" fill="url(#gScore)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Composite uses available sub-scores as we add them.
      </div>
    </div>
  );
}