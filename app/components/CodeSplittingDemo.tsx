'use client';

import { useState } from 'react';
import { createModalImport, createCardImport, createChartImport } from '@/lib/dynamicImports';

// Dynamic imports for demonstration
const DemoModal = createModalImport(() => import('./ImageOptimizationDemo'));
const DemoCard = createCardImport(() => import('./ImageOptimizationDemo'));
const DemoChart = createChartImport(() => import('./ImageOptimizationDemo'));

export default function CodeSplittingDemo() {
  const [showModal, setShowModal] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showChart, setShowChart] = useState(false);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Code Splitting Demo</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setShowModal(!showModal)}
            className="btn btn-outline btn-sm"
          >
            {showModal ? 'Hide' : 'Load'} Modal Component
          </button>
          
          <button
            onClick={() => setShowCard(!showCard)}
            className="btn btn-outline btn-sm"
          >
            {showCard ? 'Hide' : 'Load'} Card Component
          </button>
          
          <button
            onClick={() => setShowChart(!showChart)}
            className="btn btn-outline btn-sm"
          >
            {showChart ? 'Hide' : 'Load'} Chart Component
          </button>
        </div>

        <div className="space-y-4">
          {showModal && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Modal Component (Lazy Loaded)</h4>
              <DemoModal />
            </div>
          )}

          {showCard && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Card Component (Lazy Loaded)</h4>
              <DemoCard />
            </div>
          )}

          {showChart && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Chart Component (Lazy Loaded)</h4>
              <DemoChart />
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
          <p><strong>Code Splitting Benefits:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Smaller Initial Bundle:</strong> Only loads components when needed</li>
            <li><strong>Faster Page Loads:</strong> Reduces initial JavaScript payload</li>
            <li><strong>Better Caching:</strong> Components cached separately</li>
            <li><strong>Progressive Loading:</strong> Loads features on demand</li>
            <li><strong>Better Performance:</strong> Reduces main thread blocking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
