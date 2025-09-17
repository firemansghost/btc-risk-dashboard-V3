'use client';

import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="prose prose-lg max-w-none">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Disclaimer</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <p className="text-gray-800 leading-relaxed">
            The GhostGauge Bitcoin Risk Dashboard is provided for informational and educational purposes only. 
            This dashboard is not intended as investment advice, financial advice, or any other type of advice. 
            The information presented should not be construed as a recommendation to buy, sell, or hold any 
            cryptocurrency or other financial instrument.
          </p>
        </div>

        <div className="space-y-6 text-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">No Warranties</h2>
            <p>
              We make no warranties, express or implied, regarding the accuracy, completeness, or reliability 
              of the information provided. The dashboard and its data are provided "as is" without any 
              guarantee of performance or results.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Sources</h2>
            <p>
              Data sources may be delayed, incomplete, or contain errors. Market conditions can change 
              rapidly, and past performance does not guarantee future results. Users should verify 
              information independently before making any financial decisions.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Risk Warning</h2>
            <p>
              Cryptocurrency investments carry significant risk, including the potential for total loss. 
              The risk scoring methodology is experimental and should not be the sole basis for investment 
              decisions. Always consult with qualified financial professionals before making investment decisions.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Methodology</h2>
            <p>
              For detailed information about our risk scoring methodology, data sources, and calculation 
              methods, please see our{' '}
              <Link href="/methodology" className="text-blue-600 hover:text-blue-800 underline">
                Methodology page
              </Link>.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} GhostGauge. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
