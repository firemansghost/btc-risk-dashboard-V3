'use client';

import { useSearchParams } from 'next/navigation';
import { createCardImport } from '@/lib/dynamicImports';

// Dynamic imports for dashboard components
const SimpleDashboard = createCardImport(() => import('./SimpleDashboard'));
const RealDashboard = createCardImport(() => import('./RealDashboard'));

export default function ViewSwitch() {
  const sp = useSearchParams();
  const q = sp.get('view');
  const envSimple = process.env.NEXT_PUBLIC_USE_SIMPLE_DASHBOARD === 'true';
  const useSimple = q === 'simple' || (!q && envSimple);
  
  return useSimple ? <SimpleDashboard /> : <RealDashboard />;
}


