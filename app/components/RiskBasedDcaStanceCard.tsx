'use client';

import Link from 'next/link';
import { formatFriendlyTimestamp } from '@/lib/dateUtils';
import { getBandForScore } from '@/lib/riskConfig.client';
import {
  RISK_BASED_DCA_BAND_ORDER,
  RISK_BASED_DCA_MULTIPLIERS,
  getRiskBasedDcaMultiplier,
} from '@/lib/riskBasedDcaMultipliers';

export interface RiskBasedDcaStanceCardProps {
  /** Headline composite score (official or preview, matching the gauge). */
  score: number;
  /** Band label from snapshot or preview; falls back to score-derived band if missing. */
  bandLabel: string;
  asOfUtc?: string | null;
  /** When true, experimental model — not the official monthly SSOT stance. */
  isPreview?: boolean;
  className?: string;
}

const EXAMPLE_BASE_USD = 1000;

function formatMultiplierDisplay(m: number): string {
  if (m === 0) return '0×';
  if (m === 1) return '1.0×';
  return `${m}×`;
}

export default function RiskBasedDcaStanceCard({
  score,
  bandLabel,
  asOfUtc,
  isPreview = false,
  className = '',
}: RiskBasedDcaStanceCardProps) {
  const nScore = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 0;

  let resolvedLabel = (bandLabel || '').trim();
  if (!resolvedLabel || getRiskBasedDcaMultiplier(resolvedLabel) === undefined) {
    resolvedLabel = getBandForScore(nScore).label;
  }
  const multiplier = getRiskBasedDcaMultiplier(resolvedLabel) ?? 0;
  const exampleScaled = Math.round(EXAMPLE_BASE_USD * multiplier);

  return (
    <section
      id="risk-based-dca-stance"
      className={`rounded-xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6 ${className}`}
      aria-labelledby="risk-based-dca-stance-heading"
    >
      <h2
        id="risk-based-dca-stance-heading"
        className="text-lg sm:text-xl font-semibold text-gray-900 mb-2"
      >
        {isPreview ? 'Preview: Risk-Based DCA mapping' : "Today's official DCA stance"}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        How the current G-Score band maps to the published monthly Risk-Based DCA framework (contribution
        scaling vs a base plan — not a buy/sell call or personalized advice).
      </p>

      {isPreview && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong className="font-semibold">Preview model:</strong> the score and band below reflect your
          experimental weighting, not the official monthly SSOT stance used in Strategy Analysis.
        </div>
      )}

      <div className="space-y-3 text-sm text-gray-800">
        <p>
          Headline G-Score{' '}
          <strong className="font-semibold tabular-nums">{nScore}</strong>
          {asOfUtc ? (
            <>
              {' '}
              (snapshot {formatFriendlyTimestamp(asOfUtc)})
            </>
          ) : null}
          .{' '}
          {isPreview ? 'This preview score maps to the' : "Today's reading falls in the"}{' '}
          <strong className="font-semibold">{resolvedLabel}</strong> band.
        </p>
        <p>
          Under the official <strong className="font-semibold">monthly</strong> Risk-Based DCA framework
          (same multipliers as the Strategy Analysis comparison), that band scales a{' '}
          <strong className="font-semibold">base</strong> monthly contribution by{' '}
          <strong className="font-semibold tabular-nums">{formatMultiplierDisplay(multiplier)}</strong> for
          this period.
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-gray-700">Example only</span> (hypothetical, not a recommendation):
          if your base monthly amount were ${EXAMPLE_BASE_USD.toLocaleString('en-US')}, the framework would
          size this period's contribution at{' '}
          <strong className="font-semibold tabular-nums">
            ${exampleScaled.toLocaleString('en-US')}
          </strong>{' '}
          under those rules.
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Official six-band multipliers (monthly SSOT)</h3>
        <p className="text-sm text-gray-700 mb-3 leading-relaxed">
          These multipliers apply to <strong className="font-semibold">new monthly contributions</strong> only.
          They do not represent automatic sell rules for existing holdings. In this framework,{' '}
          <strong className="font-semibold">Reduce Risk</strong> means sharply reduce new adds, while{' '}
          <strong className="font-semibold">High Risk</strong> means pause new adds.
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th scope="col" className="px-3 py-2 font-medium text-gray-700">
                  Band
                </th>
                <th scope="col" className="px-3 py-2 font-medium text-gray-700 text-right">
                  Multiplier
                </th>
              </tr>
            </thead>
            <tbody>
              {RISK_BASED_DCA_BAND_ORDER.map((label) => {
                const isRow = label === resolvedLabel;
                return (
                  <tr
                    key={label}
                    className={`border-b border-gray-100 last:border-b-0 ${
                      isRow && !isPreview
                        ? 'bg-emerald-50/90 border-l-4 border-l-emerald-500'
                        : isRow && isPreview
                          ? 'bg-amber-50/90 border-l-4 border-l-amber-400'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-800">{label}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                      {formatMultiplierDisplay(RISK_BASED_DCA_MULTIPLIERS[label])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isPreview && (
          <p className="mt-2 text-xs text-gray-500">
            Highlight shows which band your preview score would fall under; official SSOT comparisons use the
            headline score and band only.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        This is a published framework for sizing new contributions relative to a base plan — not for
        trimming or selling existing positions. GhostGauge does not execute trades, tailor advice to your
        situation, or replace your own judgment.
      </p>

      <p className="mt-3 text-sm">
        <Link href="/strategy-analysis" className="text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline">
          Strategy Analysis
        </Link>
        {' · '}
        <Link href="/methodology" className="text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline">
          Methodology
        </Link>
      </p>
    </section>
  );
}
