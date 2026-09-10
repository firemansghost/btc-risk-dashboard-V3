import Link from 'next/link';

export default function AlertTypesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/alerts"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to current ETL events
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 break-words">Current ETL Event Types</h1>
          <p className="text-gray-600 mt-2">
            Event families currently exposed through the frozen production ETL output at{' '}
            <code className="bg-gray-100 px-1 rounded break-all">public/alerts/latest.json</code>.
            This is not a complete historical alert ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">ETF Flow Zero Cross</h2>
              <span className="px-2 py-1 text-xs font-medium rounded-full border bg-blue-100 text-blue-800 border-blue-200">
                etf_zero_cross
              </span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              Emitted when the frozen production ETF zero-cross detector identifies a
              sign change in its 21-day aggregate-flow measure outside its configured
              deadband.
            </p>
            <p className="text-gray-600 text-sm mt-3">
              Current-run fields, when present: direction, from, to, and deadband.
              The event records that detector output. It is not an investment
              recommendation.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">Risk Band Change</h2>
              <span className="px-2 py-1 text-xs font-medium rounded-full border bg-slate-100 text-slate-800 border-slate-200">
                band_change
              </span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              Emitted when the frozen production ETL detects that the current G-Score
              risk band differs from the comparison row used by that alert path.
            </p>
            <p className="text-gray-600 text-sm mt-3">
              Current-run fields, when present: from, to, composite_from, and
              composite_to. This is current-run output only, not a complete
              historical band-transition ledger.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-6 min-w-0">
          <h2 className="text-lg font-semibold text-amber-950 mb-3">
            Not exposed as current alert contracts
          </h2>
          <p className="text-sm text-amber-950 leading-relaxed">
            Older GhostGauge code and artifacts include Cycle/Spike, 50-week SMA,
            factor-change, and factor-staleness alert families. During H8 these are not
            presented as authoritative current public alerts because their runtime
            semantics and historical stores require a separate post-H8 repair.
          </p>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Current public contract</h2>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>Public UI reads only the latest frozen ETL event artifact.</li>
            <li>An empty current output means that artifact contained no emitted events.</li>
            <li>This page does not describe a notification service or a complete history.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
