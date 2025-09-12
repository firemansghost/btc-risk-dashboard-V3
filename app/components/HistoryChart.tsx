'use client';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { as_of_utc: string; composite: number; trendValuation?: number | null };
type Api = { ok: boolean; range: string; points: Point[] };

const ranges: Array<{ key:'30d'|'90d'|'180d'|'1y'; label:string }> = [
  { key: '30d', label: '30D' }, { key: '90d', label: '90D' }, { key: '180d', label: '180D' }, { key: '1y', label: '1Y' },
];

export default function HistoryChart() {
  const [range, setRange] = useState<'30d'|'90d'|'180d'|'1y'>('90d');
  const [data, setData] = useState<Point[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      const res = await fetch(`/api/history?range=${range}&ts=${Date.now()}`, { cache: 'no-store' });
      const json: Api = await res.json().catch(()=>({ ok:false, range, points:[] } as any));
      if (alive) {
        if (!res.ok || !json.ok) setErr('Failed to load history');
        else setData(json.points || []);
      }
    })();
    return () => { alive = false; };
  }, [range]);

  const pretty = useMemo(
    () => (data || []).map(p => ({
      date: new Date(p.as_of_utc).toISOString().slice(0,10),
      composite: p.composite ?? null,
      trendValuation: p.trendValuation ?? null,
    })),
    [data]
  );

  return (
    <div style={{ 
      borderRadius: '12px', 
      border: '1px solid #e5e7eb', 
      backgroundColor: 'white', 
      padding: '16px', 
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontWeight: '500', color: '#111827' }}>Risk History</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ranges.map(r => (
            <button 
              key={r.key} 
              onClick={() => setRange(r.key)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                border: '1px solid',
                cursor: 'pointer',
                backgroundColor: range === r.key ? '#111827' : 'white',
                color: range === r.key ? 'white' : '#6b7280',
                borderColor: range === r.key ? '#111827' : '#d1d5db'
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <div style={{ 
          fontSize: '14px', 
          color: '#dc2626', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '8px', 
          marginBottom: '12px' 
        }}>
          Error: {err}
        </div>
      )}
      <div style={{ height: '256px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pretty}>
            <defs>
              <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4}/>
            <XAxis 
              dataKey="date" 
              minTickGap={24}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              domain={[0,100]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="composite" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#gScore)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        Composite uses available sub-scores as we add them.
      </div>
    </div>
  );
}
