'use client';

import { useEffect, useState } from 'react';

export default function SimpleDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('SimpleDashboard: Loading data...');
        
        const response = await fetch('/data/latest.json', { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        console.log('SimpleDashboard: Response status:', response.status);
        
        if (response.ok) {
          const jsonData = await response.json();
          console.log('SimpleDashboard: Data loaded:', jsonData);
          setData(jsonData);
          setError(null);
        } else {
          setError(`Failed to load data: ${response.status}`);
        }
      } catch (err) {
        console.error('SimpleDashboard: Error loading data:', err);
        setError(`Error: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Simple Dashboard Test
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Data Status</h2>
          <div className="space-y-2">
            <p><strong>G-Score:</strong> {data?.composite_score || 'N/A'}</p>
            <p><strong>Band:</strong> {data?.band?.label || 'N/A'}</p>
            <p><strong>Price:</strong> {data?.btc?.spot_usd ? `$${data.btc.spot_usd.toLocaleString()}` : 'N/A'}</p>
            <p><strong>Version:</strong> {data?.model_version || 'N/A'}</p>
            <p><strong>Updated:</strong> {data?.as_of_utc ? new Date(data.as_of_utc).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
