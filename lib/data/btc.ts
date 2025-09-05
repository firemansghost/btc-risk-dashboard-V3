// lib/data/btc.ts
type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

export async function fetchCoinbaseSpot() {
  const provenance: Prov = { url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker', ok: false, status: 0, ms: 0 };
  const t0 = Date.now();
  try {
    const res = await fetch(provenance.url, { cache: 'no-store' as RequestCache, headers: { 'User-Agent': 'btc-risk-dashboard' } });
    const ms = Date.now() - t0;
    provenance.ms = ms;
    provenance.status = res.status;
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const usd = Number(j?.price ?? j?.last ?? j?.ask ?? j?.bid);
    return { usd: Number.isFinite(usd) ? usd : null, as_of_utc: new Date().toISOString(), provenance };
  } catch (e: any) {
    provenance.error = e?.message ?? String(e);
    return { usd: null, as_of_utc: new Date().toISOString(), provenance };
  }
}