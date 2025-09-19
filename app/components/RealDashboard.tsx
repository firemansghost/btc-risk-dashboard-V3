'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

function ErrorView({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return <div style={{ padding: 16 }}><p>{msg}</p><button onClick={onRetry} style={{ marginTop: 8 }}>Retry</button></div>;
}

function DashboardView({ latest, status }: { latest: any; status: any }) {
  return <div>OK — data loaded. Updated: {status?.updated_at ?? '—'}</div>;
}

export default function RealDashboard() {
  const [latest, setLatest] = useState<any|null>(null);
  const [status, setStatus] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    setError(null); setLoading(true); startedAt.current = Date.now();
    try {
      const [r1, r2] = await Promise.race([
        Promise.all([
          fetch('/data/latest.json', { cache:'no-store' }),
          fetch('/data/status.json', { cache:'no-store' }),
        ]),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout 12s: fetch artifacts')), 12000)),
      ]);
      if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status}/${r2.status}`);
      const [j1, j2] = await Promise.race([
        Promise.all([r1.json(), r2.json()]),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout 8s: parse artifacts')), 8000)),
      ]);
      setLatest(j1); setStatus(j2);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const elapsed = Math.max(0, Date.now() - (startedAt.current || Date.now()));
  if (loading && elapsed < 12000) return <p>Loading dashboard… {Math.floor(elapsed/1000)}s</p>;
  if (loading && elapsed >= 12000) return <ErrorView msg="Timed out waiting for dashboard data." onRetry={load} />;
  if (error) return <ErrorView msg={`Failed to load: ${error}`} onRetry={load} />;
  if (!latest || !status) return <ErrorView msg="Missing data artifacts." onRetry={load} />;
  return <DashboardView latest={latest} status={status} />;
}