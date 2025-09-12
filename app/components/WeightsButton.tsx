// app/components/WeightsButton.tsx
'use client';

import { useState } from 'react';
import { PILLAR_WEIGHTS, SUB_WEIGHTS, PILLAR_LABELS } from '@/lib/weights';

export default function WeightsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="View risk model weights"
      >
        Weights
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsOpen(false)}></div>
            
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Risk Model Weights</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {Object.entries(PILLAR_WEIGHTS).map(([pillar, weight]) => (
                  <div key={pillar} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900">{PILLAR_LABELS[pillar as keyof typeof PILLAR_LABELS]}</h4>
                      <span className="text-sm font-bold text-blue-600">{weight}%</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(SUB_WEIGHTS[pillar as keyof typeof SUB_WEIGHTS]).map(([subKey, subWeight]) => (
                        <div key={subKey} className="flex justify-between text-sm text-gray-600">
                          <span className="capitalize">{subKey.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span>{subWeight}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <strong>Note:</strong> On-chain Activity is displayed separately but attributed to Momentum in the composite math.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
