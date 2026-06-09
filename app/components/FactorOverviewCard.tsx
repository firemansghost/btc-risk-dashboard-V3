'use client';

import type { MouseEvent } from 'react';
import { getPillarBadgeClasses, getPillarLabel } from '@/lib/pillar-colors';
import { formatFreshnessAge, type FreshnessDisplay } from '@/lib/freshnessDisplay';
import { getFactorConfig } from '@/lib/riskConfig.client';
import { getFactorScanRole } from '@/lib/scoreInsights';
import {
  getFactorRiskScoreDisplay,
  getFactorScanRoleLabel,
  getFactorScanRolePillClasses,
} from '@/lib/factorDisplay';
import { formatDeltaDisplay, getDeltaColorClass, formatDeltaProvenance } from '@/lib/deltaUtils';
import MobileCollapsible from './MobileCollapsible';

type FactorDelta = {
  delta: number | null;
  previousScore: number | null;
  currentScore: number | null;
  currentDate: string;
  previousDate: string | null;
  basis: 'previous_day' | 'previous_available_row' | 'insufficient_history';
};

type Staleness = {
  level: string;
  className: string;
  tooltip?: string;
};

export type FactorOverviewCardProps = {
  factor: any;
  latest: any;
  compositeScore: number;
  contribution: number | null;
  staleness: Staleness;
  freshnessDisplay: FreshnessDisplay;
  factorDelta?: FactorDelta;
  onSelectFactor: (payload: {
    key: string;
    label: string;
    scrollToSection?: 'moreDetails';
  }) => void;
  onOpenHistory: (factor: { key: string; label: string }) => void;
  onOpenEnhancedDetails: (factor: { key: string; label: string }) => void;
  onJumpToFactor: (factorKey: string) => void;
  onOpenEtfBreakdown?: () => void;
  onOpenEtfPerformance?: () => void;
  status?: any;
};

function formatNetLiquidityWeightPctForCopy(): string {
  const w = getFactorConfig('net_liquidity')?.weight ?? 4.3;
  return Number.isInteger(w) ? `${w}%` : `${w.toFixed(1)}%`;
}

function stopCardClick(e: MouseEvent) {
  e.stopPropagation();
}

export default function FactorOverviewCard({
  factor,
  latest,
  compositeScore,
  contribution,
  staleness,
  freshnessDisplay,
  factorDelta,
  onSelectFactor,
  onOpenHistory,
  onOpenEnhancedDetails,
  onJumpToFactor,
  onOpenEtfBreakdown,
  onOpenEtfPerformance,
  status,
}: FactorOverviewCardProps) {
  const riskDisplay = getFactorRiskScoreDisplay(factor.score);
  const scanRole = getFactorScanRole(
    { score: factor.score ?? 0, status: factor.status },
    compositeScore
  );
  const netLiquidityPct = formatNetLiquidityWeightPctForCopy();

  return (
    <div
      id={`factor-${factor.key}`}
      className="glass-card glass-shadow card-factor card-hover cursor-pointer h-full flex flex-col transition-all hover:shadow-lg hover:scale-[1.01]"
      onClick={() => onSelectFactor({ key: factor.key, label: factor.label })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectFactor({ key: factor.key, label: factor.label });
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${factor.label}`}
    >
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-1 items-end">
        {staleness.level === 'stale' || staleness.level === 'excluded' ? (
          <span
            className={`px-2 py-1 rounded text-xs font-medium border ${staleness.className}`}
            title={staleness.tooltip}
          >
            {staleness.level}
          </span>
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-500" title="Live data" aria-label="Live data" />
        )}

        {factor.key === 'trend_valuation' && factor.sma50wDiagnostic && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium border ${
              factor.sma50wDiagnostic.showWarning
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
            title={
              factor.sma50wDiagnostic.showWarning
                ? 'Historical caution marker; display-only, not part of the score'
                : '50-week SMA status; display-only, not part of the score'
            }
          >
            {factor.sma50wDiagnostic.showWarning
              ? `Below 50W SMA (${factor.sma50wDiagnostic.consecutiveWeeksBelow}+ weeks)`
              : `Above 50W SMA ($${Math.round(factor.sma50wDiagnostic.sma50 / 1000)}k)`}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 pr-16 sm:pr-20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
          <h3 className="text-heading-3">{factor.label}</h3>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${getPillarBadgeClasses(factor.pillar)}`}
          >
            {getPillarLabel(factor.pillar)}
          </span>
        </div>

        {factor.counts_toward && factor.counts_toward !== factor.pillar && (
          <p className="text-xs text-blue-600 mb-2">
            Counts toward {factor.counts_toward}
          </p>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-h-[32px] mb-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${riskDisplay.className}`}
              aria-label={`Risk score: ${riskDisplay.scoreText}, ${riskDisplay.riskLabel}`}
            >
              Risk {riskDisplay.scoreText}
            </span>
            {riskDisplay.tier !== 'na' && (
              <span className="text-xs text-gray-600">{riskDisplay.riskLabel}</span>
            )}
            {factorDelta && (
              <span
                className={`text-xs font-medium ${getDeltaColorClass(factorDelta.delta)}`}
                title={
                  factorDelta.delta !== null
                    ? `${formatDeltaDisplay(factorDelta.delta)} points. ${formatDeltaProvenance(factorDelta)}`
                    : formatDeltaProvenance(factorDelta)
                }
              >
                {formatDeltaDisplay(factorDelta.delta)}
              </span>
            )}
          </div>

          {scanRole !== 'not_fresh' && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getFactorScanRolePillClasses(scanRole)}`}
            >
              {getFactorScanRoleLabel(scanRole)}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-600 mb-2">
          Weight {factor.weight_pct ? `${factor.weight_pct}%` : '—'}
          {' · '}
          Contribution {contribution !== null ? `${contribution.toFixed(1)} pts` : '—'}
        </p>

        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 mb-2"
          onClick={stopCardClick}
        >
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 hover:underline min-h-[32px] px-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory({ key: factor.key, label: factor.label });
            }}
          >
            History
          </button>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 hover:underline min-h-[32px] px-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEnhancedDetails({ key: factor.key, label: factor.label });
            }}
          >
            Deep dive
          </button>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <a
            href="/methodology"
            className="text-blue-600 hover:text-blue-800 hover:underline min-h-[32px] inline-flex items-center px-0.5"
            onClick={stopCardClick}
          >
            Methodology
          </a>
        </div>

        {(staleness.level === 'stale' ||
          staleness.level === 'excluded' ||
          factor.status === 'excluded') && (
          <div className="text-body-small text-gray-600 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-medium ${
                  staleness.level === 'stale'
                    ? 'text-yellow-600'
                    : staleness.level === 'excluded'
                      ? 'text-gray-600'
                      : 'text-red-600'
                }`}
              >
                {staleness.level === 'stale' ? 'Stale' : 'Excluded'}
              </span>
              {freshnessDisplay.shortLine && (
                <span className="text-body-small text-gray-500">({freshnessDisplay.shortLine})</span>
              )}
              {factor.last_utc && (
                <span className="text-body-small text-gray-500">
                  Last update:{' '}
                  {(() => {
                    const age = formatFreshnessAge(factor.last_utc);
                    return age === 'just now' ? 'just now' : `${age} ago`;
                  })()}
                </span>
              )}
            </div>
          </div>
        )}

        {factor.key === 'term_leverage' &&
          process.env.NEXT_PUBLIC_DEBUG_FACTORS === 'true' &&
          status && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs font-mono">
              <div className="font-semibold text-blue-800 mb-2">Debug Details (Term Leverage):</div>
              <div className="space-y-1 text-blue-700">
                <div>Last updated (UTC): {status.term_leverage?.last_updated_utc || 'N/A'}</div>
                <div>
                  Status: {status.term_leverage?.status || 'N/A'}{' '}
                  {status.term_leverage?.reason ? `(${status.term_leverage.reason})` : ''}
                </div>
                <div>Factor status from latest.json: {factor.status}</div>
              </div>
            </div>
          )}

        {staleness.level === 'excluded' ? (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 flex-1">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">
                Temporarily excluded from today&apos;s G-Score.
              </span>
              <br />
              <span className="text-xs">
                Reason:{' '}
                {freshnessDisplay.detailLine ||
                  freshnessDisplay.shortLine ||
                  factor.status ||
                  'stale data'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {factor.details && factor.details.length > 0 && (
              <div className="mb-3 flex-1">
                <div className="space-y-2">
                  {factor.details.slice(0, 3).map((detail: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-600 shrink-0">{detail.label}:</span>
                      <span className="font-medium text-gray-900 text-right">{detail.value}</span>
                    </div>
                  ))}
                </div>

                {factor.details.length > 3 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFactor({
                          key: factor.key,
                          label: factor.label,
                          scrollToSection: 'moreDetails',
                        });
                      }}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium underline"
                    >
                      +{factor.details.length - 3} more...
                    </button>
                  </div>
                )}

                {factor.key === 'macro_overlay' && (
                  <div className="mt-3 pt-3 border-t border-gray-100" onClick={stopCardClick}>
                    <MobileCollapsible
                      title="Related: Net Liquidity (context only)"
                      defaultOpen={false}
                      className="text-sm"
                    >
                      {(() => {
                        const netLiquidityFactor = latest?.factors?.find(
                          (f: any) => f.key === 'net_liquidity'
                        );
                        if (!netLiquidityFactor) {
                          return (
                            <p className="text-xs text-gray-500 pt-2">Net Liquidity data unavailable.</p>
                          );
                        }

                        return (
                          <div className="pt-2 space-y-2">
                            <p className="text-xs text-gray-600 leading-relaxed">
                              Macro Overlay scores dollar, rates, and volatility. Net Liquidity is scored
                              separately under Liquidity ({netLiquidityPct}) and is shown here for context
                              only — not added to this factor.
                            </p>
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900">
                                    Net Liquidity (FRED)
                                  </span>
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                    Scored separately · Liquidity {netLiquidityPct}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-gray-900 tabular-nums">
                                  {netLiquidityFactor.score !== null
                                    ? netLiquidityFactor.score.toFixed(0)
                                    : 'N/A'}
                                </span>
                              </div>
                              {netLiquidityFactor.details &&
                                netLiquidityFactor.details.length > 0 && (
                                  <div className="space-y-1">
                                    {netLiquidityFactor.details
                                      .slice(0, 2)
                                      .map((detail: any, idx: number) => (
                                        <div
                                          key={idx}
                                          className="flex justify-between items-center text-xs gap-2"
                                        >
                                          <span className="text-gray-600">{detail.label}:</span>
                                          <span className="font-medium text-gray-800">
                                            {detail.value}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              <button
                                type="button"
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                onClick={() => onJumpToFactor('net_liquidity')}
                              >
                                View Net Liquidity card →
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </MobileCollapsible>
                  </div>
                )}
              </div>
            )}

            {(!factor.details || factor.details.length === 0) && factor.status === 'excluded' && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  This factor is currently excluded due to missing configuration.
                  {factor.reason === 'missing_fred_api_key' && (
                    <span className="block mt-1 text-xs text-gray-500">
                      Requires FRED API key for economic data access.
                    </span>
                  )}
                </div>
              </div>
            )}

            {factor.key === 'etf_flows' && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" onClick={stopCardClick}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEtfBreakdown?.();
                  }}
                  className="text-blue-600 hover:text-blue-800 hover:underline min-h-[32px]"
                >
                  By ETF
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEtfPerformance?.();
                  }}
                  className="text-purple-600 hover:text-purple-800 hover:underline min-h-[32px]"
                >
                  Performance
                </button>
                <a
                  href="/etf-predictions"
                  className="text-gray-600 hover:text-gray-800 hover:underline min-h-[32px] inline-flex items-center"
                >
                  ETF predictions →
                </a>
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Last updated:{' '}
                {latest?.as_of_utc
                  ? `${new Date(latest.as_of_utc).toLocaleString()} UTC`
                  : 'Unknown'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
