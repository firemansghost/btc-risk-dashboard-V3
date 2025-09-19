'use client';

import { useSearchParams } from 'next/navigation';
import SimpleDashboard from './SimpleDashboard';
import RealDashboard from './RealDashboard';

export default function ViewSwitch() {
  const sp = useSearchParams();
  const q = sp.get('view');
  const envSimple = process.env.NEXT_PUBLIC_USE_SIMPLE_DASHBOARD === 'true';
  const useSimple = q === 'simple' || (!q && envSimple);
  
  return useSimple ? <SimpleDashboard /> : <RealDashboard />;
}


