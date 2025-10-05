'use client';

import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamic imports for dashboard components
const SimpleDashboard = dynamic(() => import('./SimpleDashboard'), {
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><div className="spinner spinner-md"></div></div>,
  ssr: false
});

const RealDashboard = dynamic(() => import('./RealDashboard'), {
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><div className="spinner spinner-md"></div></div>,
  ssr: false
});

export default function ViewSwitch() {
  const sp = useSearchParams();
  const q = sp.get('view');
  const envSimple = process.env.NEXT_PUBLIC_USE_SIMPLE_DASHBOARD === 'true';
  const useSimple = q === 'simple' || (!q && envSimple);
  
  return useSimple ? <SimpleDashboard /> : <RealDashboard />;
}


