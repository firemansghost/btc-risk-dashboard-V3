// app/data-sources/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function DataSourcesPage() {
  const [latest, setLatest] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/refresh", { method: "GET", cache: "no-store" });
        const j = await res.json();
        setLatest(j.latest ?? j);
      } catch {
        // ignore
      }
    })();
  }, []);

  const factors = latest?.factors ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Data Sources</h1>

      <div className="grid grid-cols-1 gap-4">
        {factors.map((f: any) => (
          <div key={f.key} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{f.label}</h2>
              <span className="badge badge-blue">{f.weight_pct}% weight</span>
            </div>
            <div className="mt-2 text-sm text-white/80">
              {f.source || "Source information will appear once this factor is active."}
            </div>
            <div className="mt-3 text-xs text-white/60">
              Last: {f.last_utc ?? "—"} • Status: {f.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
