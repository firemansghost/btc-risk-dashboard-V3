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
          GhostGauge — Bitcoin Risk Dashboard
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{data?.composite_score || 'N/A'}</div>
              <div className="text-sm text-gray-600">G-Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{data?.band?.label || 'N/A'}</div>
              <div className="text-sm text-gray-600">Risk Band</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data?.btc?.spot_usd ? `$${data.btc.spot_usd.toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Bitcoin Price</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{data?.model_version || 'N/A'}</div>
              <div className="text-sm text-gray-600">Model Version</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Last Updated</h2>
          <p className="text-gray-600">
            {data?.as_of_utc ? new Date(data.as_of_utc).toLocaleString() + ' UTC' : 'N/A'}
          </p>
        </div>

        {data?.factors && data.factors.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Risk Factors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.factors.map((factor: any, index: number) => (
                <div key={factor.key || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-900">{factor.label}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      factor.score !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {factor.score !== null ? factor.score.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Status: {factor.status || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Refresh Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}