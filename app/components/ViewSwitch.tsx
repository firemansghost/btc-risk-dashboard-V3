'use client';

import { useSearchParams } from 'next/navigation';
import SimpleDashboard from './SimpleDashboard';
import RealDashboard from './RealDashboard';

export default function ViewSwitch() {
  const sp = useSearchParams();
  const q = sp.get('view');
  const envSimple = process.env.NEXT_PUBLIC_USE_SIMPLE_DASHBOARD === 'true';
  const useSimple = q === 'simple' || (!q && envSimple);
  
  // Debug info
  console.log('ViewSwitch debug:', { q, envSimple, useSimple });
  
  return (
    <div>
      <div style={{fontSize:10,opacity:0.7,marginBottom:8}}>
        ViewSwitch: q={q || 'null'}, envSimple={String(envSimple)}, useSimple={String(useSimple)}
      </div>
      {useSimple ? <SimpleDashboard /> : <RealDashboard />}
    </div>
  );
}


