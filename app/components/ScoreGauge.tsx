import React from 'react';

export default function ScoreGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative h-4 w-full">
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 opacity-90" />
      <div className="absolute inset-0 rounded-full ring-1 ring-black/5" />
      {/* Pointer */}
      <div
        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 transform rounded-full border-2 border-white bg-neutral-900 shadow"
        style={{ left: `calc(${v}% - 10px)` }}
        title={`${v}`}
      />
    </div>
  );
}
