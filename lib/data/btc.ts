// lib/data/btc.ts
// Coinbase helpers: spot + daily candles (UTC).
type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

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