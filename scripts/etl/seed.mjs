import fs from "node:fs/promises";

const ISO = (d) => d.toISOString().split("T")[0]; // UTC yyyy-mm-dd

async function getCoinbaseDailyCloses(days = 10) {
  // Fetch the last `days` fully-closed UTC days from Coinbase
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // 00:00 UTC today
  const start = new Date(todayUTC.getTime() - days * 86400_000);
  const url = new URL("https://api.exchange.coinbase.com/products/BTC-USD/candles");
  url.searchParams.set("granularity", "86400");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", todayUTC.toISOString());

  const res = await fetch(url, { headers: { "User-Agent": "gg-risk-seed" } });
  if (!res.ok) throw new Error(`Coinbase ${res.status}`);
  const rows = await res.json(); // [time, low, high, open, close, volume], newest-first
  return rows
    .map(r => ({ ts: r[0] * 1000, close: r[4] }))
    .sort((a, b) => a.ts - b.ts)
    .map(r => ({ date: ISO(new Date(r.ts)), close: Number(r.close) }));
}

async function getCoinGeckoDailyCloses(days = 10) {
  const url = new URL("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", String(days));
  url.searchParams.set("interval", "daily");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const j = await res.json(); // { prices: [ [ms, price], ... ] } oldest-first
  return j.prices.map(([ms, price]) => ({
    date: ISO(new Date(ms)),
    close: Number(price),
  }));
}

function riskBand(score) {
  if (score < 15) return { name: "Aggressive Buying", lo: 0, hi: 15 };
  if (score < 35) return { name: "Regular DCA Buying", lo: 15, hi: 35 };
  if (score < 55) return { name: "Hold/Neutral", lo: 35, hi: 55 };
  if (score < 70) return { name: "Begin Scaling Out", lo: 55, hi: 70 };
  if (score < 85) return { name: "Increase Selling", lo: 70, hi: 85 };
  return { name: "Maximum Selling", lo: 85, hi: 100 };
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  await ensureDir("public/data");

  // 1) Get real daily closes
  let series = [];
  try {
    series = await getCoinbaseDailyCloses(10);
  } catch {
    series = await getCoinGeckoDailyCloses(10);
  }

  // 2) Seed a placeholder score that matches the current band (safe default)
  const seedScore = 47.0;
  const band = riskBand(seedScore);

  // 3) history.csv (real prices, placeholder score/band)
  const historyLines = [
    "date,score,band,price_usd",
    ...series.map(r => `${r.date},${seedScore},${band.name},${r.close.toFixed(2)}`)
  ].join("\n");
  await fs.writeFile("public/data/history.csv", historyLines);

  // 4) latest.json (use today's last close in the series)
  const last = series[series.length - 1];
  const latest = {
    version: "v3.0.0",
    updated_at: new Date().toISOString(),
    price_usd: last?.close ?? null,
    composite: seedScore,
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

  // 5) status.json (simple provenance stub)
  const status = {
    updated_at: new Date().toISOString(),
    sources: [
      { name: "Coinbase daily candles", ok: true, ms: null, url: "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400" },
      { name: "CoinGecko market chart (fallback)", ok: true, ms: null, url: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=10&interval=daily" }
    ]
  };
  await fs.writeFile("public/data/status.json", JSON.stringify(status, null, 2));

  console.log("Seed complete: public/data/{history.csv, latest.json, status.json}");
}

main().catch(e => { console.error(e); process.exit(1); });
