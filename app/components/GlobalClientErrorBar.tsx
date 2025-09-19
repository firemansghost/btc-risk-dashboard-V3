'use client';
import { useEffect, useState } from 'react';

export default function GlobalClientErrorBar() {
  const [err, setErr] = useState<string | null>(null);
  
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setErr(e?.message ?? String(e));
    const onRej = (e: PromiseRejectionEvent) => setErr(e?.reason?.message ?? String(e.reason));
    
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);
  
  if (!err) return null;
  
  return (
    <div style={{position:'fixed',left:0,right:0,top:0,background:'#fee',color:'#900',padding:'8px 12px',zIndex:9999}}>
      <strong>Client boot error:</strong> {err}
    </div>
  );
}
