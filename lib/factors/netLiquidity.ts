// lib/factors/netLiquidity.ts
// Net Liquidity = WALCL − RRPONTSYD − WTREGEN (weekly FRED series)
// Score: higher net-liquidity => lower risk (higher score)

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string };

const logistic01 = (x: number, k = 3, x0 = 0.5) => 1 / (1 + Math.exp(-k * (x - x0)));
const percentileRank = (arr: number[], x: number) => {
  const a = arr.filter(Number.isFinite).slice().sort((m, n) => m - n);
  if (!a.length || !Number.isFinite(x)) return NaN;
  let lt = 0, eq = 0; for (const v of a) { if (v < x) lt++; else if (v === x) eq++; else break; }
  return (lt + 0.5 * eq) / a.length;
};
const toNum = (v: any) => {
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

async function fetchFredSeries(id: string, startISO: string, endISO: string, provenance: Prov[]) {
  const key = (process.env.FRED_API_KEY || "").trim();
  if (!key) throw new Error("missing_FRED_API_KEY");
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&observation_start=${startISO}&observation_end=${endISO}&frequency=w&aggregation_method=avg`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "btc-risk-dashboard" } });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (!res.ok) { provenance.push({ url, ok: false, status: res.status, ms, error: text.slice(0, 200) }); return []; }
    provenance.push({ url, ok: true, status: res.status, ms });
    const j = JSON.parse(text);
    const obs = Array.isArray(j?.observations) ? j.observations : [];
    return obs.map((o: any) => ({ date: String(o?.date).slice(0, 10), value: toNum(o?.value) }));
  } catch (e: any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok: false, status: 0, ms, error: e?.message ?? String(e) });
    return [];
  }
}

export async function computeNetLiquidity() {
  const provenance: Prov[] = [];
  // ~3 years (≈ 160 weeks) history
  const end = new Date();
  const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 7 * 170);
  const endISO = end.toISOString().slice(0, 10);
  const startISO = start.toISOString().slice(0, 10);

  try {
    const [walcl, rrp, tga] = await Promise.all([
      fetchFredSeries("WALCL", startISO, endISO, provenance),
      fetchFredSeries("RRPONTSYD", startISO, endISO, provenance),
      fetchFredSeries("WTREGEN", startISO, endISO, provenance),
    ]);

    if (!walcl.length || !rrp.length || !tga.length) {
      return { score: null, last_utc: null, source: null, details: [], provenance };
    }

    // Align by weekly date with forward-fill
    const dates = Array.from(new Set([...walcl, ...rrp, ...tga].map(d => d.date))).sort();
    const toMap = (arr: any[]) => new Map(arr.map((r: any) => [r.date, r.value]));
    const mW = toMap(walcl), mR = toMap(rrp), mT = toMap(tga);

    let lastW = NaN, lastR = NaN, lastT = NaN;
    const nl: number[] = [];
    for (const d of dates) {
      if (Number.isFinite(mW.get(d))) lastW = mW.get(d)!;
      if (Number.isFinite(mR.get(d))) lastR = mR.get(d)!;
      if (Number.isFinite(mT.get(d))) lastT = mT.get(d)!;
      if (Number.isFinite(lastW) && Number.isFinite(lastR) && Number.isFinite(lastT)) {
        nl.push(lastW - lastR - lastT);
      } else {
        nl.push(NaN);
      }
    }

    const nlClean = nl.filter(Number.isFinite) as number[];
    if (!nlClean.length) return { score: null, last_utc: null, source: null, details: [], provenance };

    const latest = nlClean.at(-1)!;
    const pr = percentileRank(nlClean, latest);
    const score = Math.round(100 * logistic01(pr, 3)); // higher nl → higher pr → higher score

    const last_utc = dates.at(-1)! + "T00:00:00.000Z";
    const latestBn = Number.isFinite(latest) ? (latest / 1e3).toFixed(1) : "—";
    return {
      score,
      last_utc,
      source: "FRED (WALCL − RRPONTSYD − WTREGEN, weekly)",
      details: [
        { label: "Latest Net Liquidity (bn USD)", value: latestBn },
        { label: "Window size (weeks)", value: nlClean.length },
        { label: "Percentile (window)", value: `${Math.round(pr * 100)}%` },
      ],
      provenance,
    };
  } catch {
    return { score: null, last_utc: null, source: null, details: [], provenance };
  }
}
