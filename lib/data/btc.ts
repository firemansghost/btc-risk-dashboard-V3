// lib/data/btc.ts
type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

export async function fetchCoinbaseSpot() {
  const provenance: Prov = { url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker', ok: false, status: 0, ms: 0 };
  const t0 = Date.now();
  try {
    const res = await fetch(provenance.url, { cache: 'no-store' });
    const ms = Date.now() - t0;
    provenance.ms = ms; provenance.status = res.status; provenance.ok = res.ok;
    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();
    const usd = Number(j?.price);
    return { usd: Number.isFinite(usd) ? usd : null, as_of_utc: new Date().toISOString(), provenance };
  } catch (e: any) {
    provenance.error = e?.message ?? String(e);
    return { usd: null, as_of_utc: null, provenance };
  }
}
