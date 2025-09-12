// app/components/BandBar.tsx
"use client";

export default function BandBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="w-full">
      <div className="meter"><span style={{ width: `${pct}%` }} /></div>
      <div className="mt-2 flex text-[11px] text-white/60 justify-between">
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}
