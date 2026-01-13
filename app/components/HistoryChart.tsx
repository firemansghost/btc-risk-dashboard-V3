'use client';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { 
  date: string; 
  composite: number; 
  trend_valuation?: number | null;
  net_liquidity?: number | null;
  stablecoins?: number | null;
  term_leverage?: number | null;
  onchain?: number | null;
  etf_flows?: number | null;
  social_interest?: number | null;
  macro_overlay?: number | null;
};

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
      try {
        const res = await fetch(`/data/history.csv?ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          setErr('Failed to load history CSV');
          return;
        }
        
        const csvText = await res.text();
        const lines = csvText.trim().split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          setErr('No history data available');
          return;
        }
        
        // Parse CSV - find the header line
        let headerIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('date,composite')) {
            headerIndex = i;
            break;
          }
        }
        
        const headers = lines[headerIndex].split(',');
        const data: Point[] = [];
        
        for (let i = headerIndex + 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length !== headers.length) continue;
          
          const point: Point = {
            date: values[0],
            composite: parseFloat(values[1]) || 0,
            trend_valuation: values[2] ? parseFloat(values[2]) : null,
            net_liquidity: values[3] ? parseFloat(values[3]) : null,
            stablecoins: values[4] ? parseFloat(values[4]) : null,
            term_leverage: values[5] ? parseFloat(values[5]) : null,
            onchain: values[6] ? parseFloat(values[6]) : null,
            etf_flows: values[7] ? parseFloat(values[7]) : null,
            social_interest: values[8] ? parseFloat(values[8]) : null,
            macro_overlay: values[9] ? parseFloat(values[9]) : null,
          };
          data.push(point);
        }
        
        if (alive) {
          setData(data);
        }
      } catch (error) {
        if (alive) {
          setErr('Failed to parse history data');
        }
      }
    })();
    return () => { alive = false; };
  }, [range]);

  const pretty = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Filter by range
    const now = new Date();
    const cutoff = new Date();
    switch (range) {
      case '30d': cutoff.setDate(now.getDate() - 30); break;
      case '90d': cutoff.setDate(now.getDate() - 90); break;
      case '180d': cutoff.setDate(now.getDate() - 180); break;
      case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
    }
    
    const filtered = data.filter(p => new Date(p.date) >= cutoff);
    
    // Apply EWMA smoothing (alpha = 0.1 from config)
    const alpha = 0.1;
    const smoothed: typeof filtered = [];
    filtered.forEach((p, i) => {
      if (i === 0) {
        smoothed.push(p);
      } else {
        const prev = smoothed[i - 1];
        smoothed.push({
          ...p,
          composite: alpha * p.composite + (1 - alpha) * prev.composite
        });
      }
    });
    
    return smoothed.map(p => ({
      date: p.date,
      composite: Math.round(p.composite),
      trendValuation: p.trend_valuation,
    }));
  }, [data, range]);

  return (
    <div className="h-full flex flex-col">
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
      {!err && pretty.length === 0 && (
        <div style={{ 
          height: '256px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '4px' }}>No history data yet.</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Run the daily ETL or refresh after first snapshot.
          </div>
        </div>
      )}
      {!err && pretty.length > 0 && (
        <div className="flex-1 min-h-0">
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
      )}
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        Composite uses available sub-scores as we add them.
      </div>
    </div>
  );
}
