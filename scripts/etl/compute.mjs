import fs from "node:fs/promises";
import { computeAllFactors } from "./factors.mjs";

// Load environment variables from .env.local if it exists
try {
  const envContent = await fs.readFile('.env.local', 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // .env.local doesn't exist, that's fine
}

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
  
  // Clean old cache files
  try {
    const { cleanOldCacheFiles } = await import('./factors.mjs');
    await cleanOldCacheFiles();
  } catch (error) {
    console.warn('Could not clean cache files:', error.message);
  }

  // 1) Get yesterday's close (Coinbase → CG fallback)
  let y;
  try { y = await getCoinbaseCloseForYesterday(); }
  catch { y = await getCoinGeckoCloseForYesterday(); }

  // 2) Compute real risk factors
  console.log("Computing real risk factors...");
  const factorResults = await computeAllFactors();
  const composite = factorResults.composite;
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

  // 4) latest.json with real factor data
  const latest = {
    version: "v3.1.0",
    updated_at: new Date().toISOString(),
    price_usd: y.close,
    composite,
    band,
    factors: factorResults.factors,
    adjustments: { cycle_nudge: 0.0, spike_nudge: 0.0 },
    config_digest: "etl_real_factors"
  };
  await fs.writeFile("public/data/latest.json", JSON.stringify(latest, null, 2));

  // 5) status.json (preserve existing data like schema hashes)
  let existingStatus = {};
  try {
    const existingContent = await fs.readFile("public/data/status.json", "utf8");
    existingStatus = JSON.parse(existingContent);
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
  }
  
  const status = {
    ...existingStatus, // Preserve existing data like etf_schema_hash
    updated_at: new Date().toISOString(),
    sources: [
      { name: "Coinbase daily candles", ok: true, ms: null, url: "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400" },
      { name: "CoinGecko market chart (fallback)", ok: true, ms: null, url: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily" },
      { name: "Fear & Greed Index", ok: true, ms: null, url: "https://api.alternative.me/fng/" },
      { name: "FRED API (if key provided)", ok: !!process.env.FRED_API_KEY, ms: null, url: "https://fred.stlouisfed.org/" }
    ],
    factors_computed: factorResults.factors.length,
    factors_successful: factorResults.factors.filter(f => f.status === 'fresh').length
  };
  await fs.writeFile("public/data/status.json", JSON.stringify(status, null, 2));

  console.log(`ETL compute OK for ${y.date}`);
  console.log(`Composite score: ${composite} (${band.name})`);
  console.log(`Factors: ${factorResults.factors.filter(f => f.status === 'fresh').length}/${factorResults.factors.length} successful`);
}

main().catch(e => { console.error(e); process.exit(1); });
