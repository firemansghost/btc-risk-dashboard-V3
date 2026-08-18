'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { parseGScoreHistoryCsv, type HistoryChartPoint, type HistoryRange } from '@/lib/historyChartCsv';
import {
  buildHistoryPresentation,
  formatBtcPrice,
  formatUtcLongDate,
  type HistoryPresentationRow,
} from '@/lib/historyProvenance';

const ranges: Array<{ key: HistoryRange; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '180d', label: '180D' },
  { key: '1y', label: '1Y' },
];

const OBSERVED_STROKE = '#10b981';
const TREND_STROKE = '#047857';
const LEGACY_STROKE = '#6b7280';

function HistoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryPresentationRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;

  if (row.isHiddenLegacy || (!row.isObservation && !row.isGap)) return null;

  if (row.isGap) {
    return (
      <div
        style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#f9fafb',
          padding: '8px 10px',
          fontSize: '12px',
        }}
      >
        <div>{formatUtcLongDate(row.date)}</div>
        <div>No print this day</div>
      </div>
    );
  }

  const eraNote =
    row.verifiedModelEra === 'v1.1-last'
      ? 'Last verified v1.1 print'
      : row.verifiedModelEra === 'v1.1.1+'
        ? 'v1.1.1'
        : null;

  return (
    <div
      style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        color: '#f9fafb',
        padding: '8px 10px',
        fontSize: '12px',
        maxWidth: '16rem',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{formatUtcLongDate(row.date)}</div>
      <div>G-Score {row.score}</div>
      {row.band ? <div>{row.band}</div> : null}
      {row.price_usd != null ? <div>{formatBtcPrice(row.price_usd)}</div> : null}
      <div>
        {row.provenance === 'reconstructed' ? 'Legacy reconstruction' : 'Observed'}
        {row.provenance === 'observed' && eraNote ? ` · ${eraNote}` : ''}
      </div>
      {row.trendScore != null ? <div>Trend {row.trendScore}</div> : null}
    </div>
  );
}

export default function HistoryChart() {
  const [range, setRange] = useState<HistoryRange>('90d');
  const [showLegacy, setShowLegacy] = useState(false);
  const [data, setData] = useState<HistoryChartPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/data/history.csv?ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          setErr('Failed to load history CSV');
          return;
        }

        const csvText = await res.text();
        const parsed = parseGScoreHistoryCsv(csvText);
        if (parsed.length < 1) {
          setErr('No history data available');
          return;
        }

        if (alive) {
          setData(parsed);
        }
      } catch {
        if (alive) {
          setErr('Failed to parse history data');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const presentation = useMemo(() => {
    if (!data.length) return null;
    return buildHistoryPresentation({ points: data, range, showLegacy });
  }, [data, range, showLegacy]);

  const tickFormatter = (ms: number) => {
    if (!Number.isFinite(ms)) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(ms));
  };

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '14px',
              border: '1px solid',
              cursor: 'pointer',
              backgroundColor: range === r.key ? '#111827' : 'white',
              color: range === r.key ? 'white' : '#6b7280',
              borderColor: range === r.key ? '#111827' : '#d1d5db',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {err && (
        <div
          style={{
            fontSize: '14px',
            color: '#dc2626',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '12px',
          }}
        >
          Error: {err}
        </div>
      )}
      {!err && !presentation && (
        <div
          style={{
            height: '256px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: '14px',
          }}
        >
          <div style={{ marginBottom: '4px' }}>No history data yet.</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Run the daily ETL or refresh after first snapshot.
          </div>
        </div>
      )}
      {!err && presentation && (
        <div
          className="h-[260px] min-h-[220px] w-full min-w-0"
          role="img"
          aria-label="Historical G-Score chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={presentation.rows}
              margin={{ top: 18, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={presentation.domain}
                tickFormatter={tickFormatter}
                minTickGap={28}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                width={32}
              />
              <Tooltip content={<HistoryTooltip />} />
              {presentation.showsModelEraMarker && (
                <ReferenceLine
                  x={presentation.modelEraMarkerTimestamp}
                  stroke="#9ca3af"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Implementation change',
                    position: 'insideTopLeft',
                    fontSize: 10,
                    fill: '#6b7280',
                  }}
                />
              )}
              {presentation.showsProvenanceMarker && (
                <ReferenceLine
                  x={presentation.provenanceMarkerTimestamp}
                  stroke="#d1d5db"
                  strokeDasharray="2 4"
                  label={{
                    value: 'Observed series begins',
                    position: 'insideBottomLeft',
                    fontSize: 10,
                    fill: '#6b7280',
                  }}
                />
              )}
              {presentation.showsLegacySeries && (
                <Line
                  type="linear"
                  dataKey="reconstructedScore"
                  name="Legacy reconstruction"
                  stroke={LEGACY_STROKE}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              {presentation.showsLegacySeries && (
                <Line
                  type="linear"
                  dataKey="reconstructedTrend"
                  name="Legacy trend"
                  stroke={LEGACY_STROKE}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  strokeOpacity={0.7}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
              <Line
                type="linear"
                dataKey="observedScore"
                name="Observed G-Score"
                stroke={OBSERVED_STROKE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="observedTrendPreV111"
                name="Trend"
                stroke={TREND_STROKE}
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="observedTrendV111"
                name="Trend"
                stroke={TREND_STROKE}
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-gray-500">
        This chart uses observed G-Score prints from Sep 27, 2025 onward. Days without a print are
        left blank — they are not filled in. The trend line is a display aid, not the published score.
      </p>
      <div className="mt-2 text-xs leading-5 text-gray-600" aria-live="polite">
        <span>Observed G-Score (solid) · Trend (thin)</span>
        {presentation?.showsLegacySeries ? (
          <span> · Legacy reconstruction (dashed, not published at the time)</span>
        ) : null}
      </div>
      {range === '1y' && !showLegacy && (
        <p className="mt-1 text-xs leading-5 text-gray-500">
          This chart uses observed prints from Sep 27, 2025 onward, so a full year of observed
          history is not yet available here.
        </p>
      )}
      {presentation?.showsModelEraMarker && (
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Scoring implementation changed Aug 17, 2026. The Aug 16→17 move is not a pure market
          reading.
        </p>
      )}
      {presentation?.showsProvenanceMarker && (
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Observed series in this chart begins Sep 27, 2025
        </p>
      )}
      <button
        type="button"
        className="mt-3 self-start rounded border px-3 py-1 text-sm"
        style={{
          borderColor: showLegacy ? '#111827' : '#d1d5db',
          backgroundColor: showLegacy ? '#111827' : 'white',
          color: showLegacy ? 'white' : '#4b5563',
        }}
        aria-pressed={showLegacy}
        onClick={() => setShowLegacy((v) => !v)}
      >
        Show legacy reconstruction
      </button>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        Earlier values in this file are a later reconstruction. They are shown only when legacy
        reconstruction is enabled and only for context.
      </p>
      {showLegacy && presentation?.legacyOutOfRange && (
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Legacy reconstruction is earlier than this range. Choose 1Y to view it.
        </p>
      )}
    </div>
  );
}
