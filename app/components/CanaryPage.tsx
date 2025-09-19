'use client';
import { useEffect, useState } from 'react';
import ViewSwitch from './ViewSwitch';

export default function CanaryPage() {
  const [t, setT] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  
  return (
    <main style={{padding:16}}>
      <div style={{fontSize:12,opacity:0.8}}>Hydration canary: {t}s (should tick)</div>
      <ViewSwitch />
    </main>
  );
}
