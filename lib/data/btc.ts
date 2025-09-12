// lib/data/btc.ts
// Coinbase helpers: spot + daily candles (UTC).
type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

export type DailyCandle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export async function fetchCoinbaseSpot() {
  const provenance: Prov = { url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker', ok: false, status: 0, ms: 0 };
  const t0 = Date.now();
  try {
    const res = await fetch(provenance.url, { cache: 'no-store', headers: { 'User-Agent': 'btc-risk-dashboard' } as any });
    const ms = Date.now() - t0;
    provenance.ms = ms;
    provenance.status = res.status;
    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();
    const usd = Number(j?.price ?? j?.last ?? j?.ask ?? j?.bid);
    return { usd, as_of_utc: new Date().toISOString(), provenance };
  } catch (e: any) {
    provenance.error = e?.message ?? String(e);
    return { usd: NaN, as_of_utc: new Date().toISOString(), provenance };
  }
}

/**
 * Fetch daily candles [time, low, high, open, close, volume] from Coinbase.
 * Coinbase returns newest-first; we sort ascending by time.
 */
export async function fetchCoinbaseDailyCandles(startISO: string, endISO: string) {
  const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${encodeURIComponent(
    startISO
  )}&end=${encodeURIComponent(endISO)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'btc-risk-dashboard' } as any });
    const ms = Date.now() - t0;
    const txt = await res.text();
    if (!res.ok) {
      return { ok: false, url, status: res.status, ms, error: txt.slice(0, 200), candles: [] as number[][] };
    }
    const arr = JSON.parse(txt) as number[][];
    // Ensure ascending by timestamp
    arr.sort((a, b) => a[0] - b[0]);
    return { ok: true, url, status: 200, ms, candles: arr };
  } catch (e: any) {
    return { ok: false, url, status: 0, ms: Date.now() - t0, error: e?.message ?? String(e), candles: [] as number[][] };
  }
}

/**
 * Fetch daily candles for a specified number of days
 * @param days Number of days to fetch
 * @param provenance Optional array to collect provenance information
 * @returns Array of daily candles (oldest to newest)
 */
export async function fetchDailyCandles(days: number, provenance?: any[]): Promise<DailyCandle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const params = new URLSearchParams({
    granularity: '86400',
    start: start.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    end: end.toISOString().slice(0, 10) + 'T00:00:00.000Z',
  }).toString();

  const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?${params}`;
  const t0 = Date.now();
  
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'btc-risk-dashboard' } as any });
    const ms = Date.now() - t0;
    const txt = await res.text();

    if (provenance) {
      provenance.push({ url, ok: res.ok, status: res.status, ms, note: 'Coinbase daily candles' });
    }

    if (!res.ok) {
      throw new Error(txt.slice(0, 200));
    }

    // Coinbase returns arrays [time, low, high, open, close, volume], newest-first
    const rows: any[] = JSON.parse(txt);
    const candles = rows
      .map((r, i) => ({
        time: Number(r[0]) * 1000, // Convert to milliseconds
        open: Number(r[3]),
        high: Number(r[2]),
        low: Number(r[1]),
        close: Number(r[4]),
        volume: Number(r[5]) || undefined,
      }))
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
      .reverse(); // Convert to oldest-first

    return candles;
  } catch (e: any) {
    const ms = Date.now() - t0;
    if (provenance) {
      provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    }
    throw e;
  }
}