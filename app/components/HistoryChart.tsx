'use client';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  filterHistoryByRange,
  parseGScoreHistoryCsv,
  smoothHistoryScores,
  type HistoryChartPoint,
} from '@/lib/historyChartCsv';

const ranges: Array<{ key: '30d' | '90d' | '180d' | '1y'; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '180D' },
  { key: '1y', label: '1Y' },
];

export default function HistoryChart() {
  const [range, setRange] = useState<'30d' | '90d' | '180d' | '1y'>('90d');
  const [data, setData] = useState<HistoryChartPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/data/history.csv?ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          setErr('Failed to load history CSV');
          return;
        }

        const csvText = await res.text();
        const parsed = parseGScoreHistoryCsv(csvText);
        if (parsed.length < 1) {
          setErr('No history data available');
          return;
        }

        if (alive) {
          setData(parsed);
        }
      } catch {
        if (alive) {
          setErr('Failed to parse history data');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pretty = useMemo(() => {
    if (!data.length) return [];
    const filtered = filterHistoryByRange(data, range);
    return smoothHistoryScores(filtered, 0.1);
  }, [data, range]);

  return (
    <div className="flex flex-col">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontWeight: '500', color: '#111827' }}>Risk History</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ranges.map((r) => (
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
                borderColor: range === r.key ? '#111827' : '#d1d5db',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {err && (
        <div
          style={{
            fontSize: '14px',
            color: '#dc2626',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '12px',
          }}
        >
          Error: {err}
        </div>
      )}
      {!err && pretty.length === 0 && (
        <div
          style={{
            height: '256px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: '14px',
          }}
        >
          <div style={{ marginBottom: '4px' }}>No history data yet.</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Run the daily ETL or refresh after first snapshot.
          </div>
        </div>
      )}
      {!err && pretty.length > 0 && (
        <div className="h-[260px] min-h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pretty}>
              <defs>
                <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
              <XAxis
                dataKey="date"
                minTickGap={24}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb',
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
      )}
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        Daily official G-Score from history.csv (EWMA-smoothed display).
      </div>
    </div>
  );
}
