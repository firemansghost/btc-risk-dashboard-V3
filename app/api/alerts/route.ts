import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCE = 'public/alerts/latest.json';
const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const BASE_CONTRACT = {
  mode: 'current_etl_output' as const,
  source: SOURCE,
  history_complete: false as const,
  legacy_sources_excluded: true as const,
};

function clampLimit(raw: string | null): number {
  if (raw == null || raw.trim() === '') return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

function unavailableResponse(status = 503) {
  return NextResponse.json(
    {
      success: false,
      ...BASE_CONTRACT,
      occurred_at: null,
      alerts: [],
      total: 0,
      filtered: 0,
      event_types: [] as string[],
      note: 'Current ETL event output unavailable.',
    },
    { status, headers: NO_CACHE_HEADERS }
  );
}

export async function GET(request: Request) {
  let payload: unknown;

  try {
    const filePath = path.join(process.cwd(), SOURCE);
    const content = await fs.readFile(filePath, 'utf8');
    payload = JSON.parse(content);
  } catch {
    return unavailableResponse(503);
  }

  if (
    payload == null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Array.isArray((payload as { alerts?: unknown }).alerts)
  ) {
    return unavailableResponse(503);
  }

  const artifact = payload as { occurred_at?: unknown; alerts: unknown[] };
  const currentEvents = artifact.alerts;
  const occurredAt =
    typeof artifact.occurred_at === 'string' && artifact.occurred_at.trim() !== ''
      ? artifact.occurred_at
      : null;

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get('type');
  const limit = clampLimit(url.searchParams.get('limit'));

  const typedEvents =
    typeFilter && typeFilter.trim() !== ''
      ? currentEvents.filter(
          (event) =>
            event != null &&
            typeof event === 'object' &&
            (event as { type?: unknown }).type === typeFilter
        )
      : currentEvents;

  const alerts = typedEvents.slice(0, limit);
  const eventTypes = [
    ...new Set(
      currentEvents
        .map((event) =>
          event != null && typeof event === 'object'
            ? (event as { type?: unknown }).type
            : undefined
        )
        .filter((type): type is string => typeof type === 'string' && type.length > 0)
    ),
  ];

  return NextResponse.json(
    {
      success: true,
      ...BASE_CONTRACT,
      occurred_at: occurredAt,
      alerts,
      total: currentEvents.length,
      filtered: alerts.length,
      event_types: eventTypes,
      note: 'Current ETL output only; not a complete historical alert ledger.',
    },
    { headers: NO_CACHE_HEADERS }
  );
}
