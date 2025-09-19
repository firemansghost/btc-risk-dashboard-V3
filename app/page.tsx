import SimpleDashboard from './components/SimpleDashboard';
import RealDashboard from './components/RealDashboard';

export default function Page({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const viewParam = searchParams?.view;
  const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;

  // Priority: URL param > env flag > default to RealDashboard
  const envSimple = process.env.NEXT_PUBLIC_USE_SIMPLE_DASHBOARD === 'true';
  const useSimple = view === 'simple' || (!view && envSimple);

  return useSimple ? <SimpleDashboard /> : <RealDashboard />;
}
