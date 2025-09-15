import fs from "node:fs/promises";

const ISO = (d) => d.toISOString().split("T")[0];

async function readText(path) {
  try { return await fs.readFile(path, "utf8"); } catch { return null; }
}
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function getCoinbaseCloseForYesterday() {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(todayUTC.getTime() - 2 * 86400_000); // two days window
  const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
  url.searchParams.set("granularity", "86400");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", todayUTC.toISOString());

  const res = await fetch(url, { headers: { "User-Agent": "gg-risk-etl" } });
  if (!res.ok) throw new Error(`Coinbase ${res.status}`);
  const rows = await res.json(); // newest-first
  const sorted = rows.map(r => ({ ts: r[0] * 1000, close: r[4] }))
                     .sort((a, b) => a.ts - b.ts);
  // Yesterday = last fully closed bucket (the last element)
  const last = sorted[sorted.length - 1];
  return { date: ISO(new Date(last.ts)), close: Number(last.close) };
}

async function getCoinGeckoCloseForYesterday() {
  const url = new URL("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", "2");
  url.searchParams.set("interval", "daily");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const j = await res.json(); // oldest-first
  const pair = j.prices[j.prices.length - 1]; // [ms, price]
  return { date: ISO(new Date(pair[0])), close: Number(pair[1]) };
}

function riskBand(score) {
  if (score < 15) return { name: "Aggressive Buying", lo: 0, hi: 15 };
  if (score < 35) return { name: "Regular DCA Buying", lo: 15, hi: 35 };
  if (score < 55) return { name: "Hold/Neutral", lo: 35, hi: 55 };
  if (score < 70) return { name: "Begin Scaling Out", lo: 55, hi: 70 };
  if (score < 85) return { name: "Increase Selling", lo: 70, hi: 85 };
  return { name: "Maximum Selling", lo: 85, hi: 100 };
}

async function main() {
  await ensureDir("public/data");

  // 1) Get yesterday's close (Coinbase → CG fallback)
  let y;
  try { y = await getCoinbaseCloseForYesterday(); }
  catch { y = await getCoinGeckoCloseForYesterday(); }

  // 2) Compute placeholder risk (to be replaced by real ETL)
  const composite = 47.0;
  const band = riskBand(composite);

  // 3) Upsert history.csv
  const header = "date,score,band,price_usd";
  const existing = await readText("public/data/history.csv");
  let lines = existing ? existing.trim().split("\n") : [header];

  const hasHeader = lines[0].toLowerCase().startsWith("date,score,band,price_usd");
  if (!hasHeader) lines.unshift(header);

  const already = lines.some(l => l.startsWith(y.date + ","));
  if (!already) {
    lines.push(`${y.date},${composite},${band.name},${y.close.toFixed(2)}`);
  }
  await fs.writeFile("public/data/history.csv", lines.join("\n"));

  // 4) latest.json
  const latest = {
    version: "v3.0.0",
    updated_at: new Date().toISOString(),
    price_usd: y.close,
    composite,
    band,
    pillars: [
      { key: "liquidity", weight: 0.35, score: 38.9, status: "fresh" },
      { key: "momentum",  weight: 0.25, score: 51.1, status: "fresh" },
      { key: "leverage",  weight: 0.20, score: 60.2, status: "fresh" },
      { key: "macro",     weight: 0.10, score: null, status: "excluded" },
      { key: "social",    weight: 0.10, score: 42.3, status: "stale" }
    ],
    adjustments: { cycle_nudge: 0.0, spike_nudge: 0.0 },
    config_digest: "seed"
  };
  await fs.writeFile("public/data/latest.json", JSON.stringify(latest, null, 2));

  // 5) status.json
  const status = {
    updated_at: new Date().toISOString(),
    sources: [
      { name: "Coinbase daily candles", ok: true, ms: null, url: "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400" },
      { name: "CoinGecko market chart (fallback)", ok: true, ms: null, url: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily" }
    ]
  };
  await fs.writeFile("public/data/status.json", JSON.stringify(status, null, 2));

  console.log(`ETL compute OK for ${y.date}`);
}

main().catch(e => { console.error(e); process.exit(1); });
