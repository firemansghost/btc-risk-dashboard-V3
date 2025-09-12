// lib/factors/etfFlows.ts
// ETF flows (US spot BTC)
// Supports:
//  - ETF_FLOWS_PATH: local CSV/JSON
//  - ETF_FLOWS_URL:  remote CSV/JSON/HTML (e.g., Farside pages)
//  - ETF_FLOWS_ALT_URL: optional extra URL (CSV/JSON) to try if the primary fails
//
// Strategy on HTML pages:
//  1) Look for CSV links (many patterns).
//  2) Try to extract JSON arrays embedded in <script> tags.
//  3) Try inline CSV in <pre>.
//  4) Parse <table> as a last resort.
// Score = percentile of 21d rolling sum of net flows (higher inflows => lower risk).

import { promises as fs } from "node:fs";
import path from "node:path";

type Prov = { url: string; ok: boolean; status: number; ms: number; error?: string; note?: string };

const mean = (a: number[]) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((s,v)=>s+v,0)/x.length : NaN; };
const percentileRank = (arr: number[], x: number) => {
  const a = arr.filter(Number.isFinite).slice().sort((m,n)=>m-n);
  if (!a.length || !Number.isFinite(x)) return NaN;
  let lt=0, eq=0; for (const v of a){ if (v<x) lt++; else if (v===x) eq++; else break; }
  return (lt + 0.5*eq)/a.length;
};
const logistic01 = (x:number,k=3,x0=0.5)=> 1/(1+Math.exp(-k*(x-x0)));

function cleanNumStr(s: string) {
  return s
    .replace(/[\s,]/g, '')
    .replace(/[–—−]/g, '-')          // fancy minus → minus
    .replace(/\(([^)]+)\)/, '-$1');  // (123) -> -123
}
function toNum(x: any): number {
  if (x == null) return NaN;
  const n = Number(cleanNumStr(String(x).replace(/\$/g,'')));
  return Number.isFinite(n) ? n : NaN;
}
const decodeEntities = (s: string) => s.replace(/&amp;/g, "&");

async function fetchRaw(url: string, provenance: Prov[]) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        // Be as browser-like as possible
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      cache: "no-store" as RequestCache,
    });
    const ms = Date.now() - t0;
    const body = await res.text();
    provenance.push({ url, ok: res.ok, status: res.status, ms, error: res.ok ? undefined : body.slice(0,200) });
    return res.ok ? body : null;
  } catch (e:any) {
    const ms = Date.now() - t0;
    provenance.push({ url, ok:false, status: 0, ms, error: e?.message ?? String(e) });
    return null;
  }
}
const tryParseJson = (t:string) => { try { return JSON.parse(t); } catch { return null; } };

// ---------- CSV / HTML parsing ----------------------------------------------
function parseCsv(text: string): Array<Record<string,string>> {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = lines[0].split(",").map(s => s.trim());
  const rows: Array<Record<string,string>> = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(",");
    const obj: Record<string,string> = {};
    head.forEach((h,idx)=> obj[h] = (cols[idx] ?? "").trim());
    rows.push(obj);
  }
  return rows;
}

type Row = { date: string; flow: number; aum?: number };

function normalizeObjects(objs: any[]): Row[] {
  const out = new Map<string, { flow: number; aum?: number }>();
  const push = (date: string, flow: number, aum?: number) => {
    if (!date || !Number.isFinite(flow)) return;
    const cur = out.get(date) || { flow: 0, aum: undefined };
    cur.flow += flow;
    if (Number.isFinite(aum!)) cur.aum = (cur.aum ?? 0) + (aum as number);
    out.set(date, cur);
  };
  const FLOW_KEYS = ["net_flow","netflow","flow","net_usd","net_flow_usd","total_flow_usd","daily_net_flow_usd","inflow_net","net","total"];
  const AUM_KEYS  = ["aum","aum_usd","total_aum","assets","assets_usd","tna","nav","a_u_m"];

  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    const lo: Record<string, any> = {};
    for (const k of Object.keys(o)) lo[k.toLowerCase()] = (o as any)[k];

    const date = (lo["date"] ?? lo["day"] ?? lo["dt"] ?? lo["asof"]) ? String(lo["date"] ?? lo["day"] ?? lo["dt"] ?? lo["asof"]) : "";
    let flow = NaN;
    for (const k of FLOW_KEYS) if (Number.isFinite(toNum(lo[k]))) { flow = toNum(lo[k]); break; }
    if (!Number.isFinite(flow) && Number.isFinite(toNum(lo["inflow"])) && Number.isFinite(toNum(lo["outflow"]))) {
      flow = toNum(lo["inflow"]) - toNum(lo["outflow"]);
    }
    let aum = NaN;
    for (const k of AUM_KEYS) if (Number.isFinite(toNum(lo[k]))) { aum = toNum(lo[k]); break; }

    if (date && (Number.isFinite(flow) || Number.isFinite(aum))) {
      const d = date.slice(0,10);
      push(d, Number.isFinite(flow) ? flow : NaN, Number.isFinite(aum) ? aum : undefined);
    }
  }
  return [...out.entries()].map(([date, v]) => ({ date, flow: v.flow, aum: v.aum }));
}
const normalizeFromJson = (json:any): Row[] => {
  if (Array.isArray(json)) return normalizeObjects(json);
  if (json && typeof json === "object") {
    for (const key of ["data","rows","result","items"]) {
      if (Array.isArray((json as any)[key])) return normalizeObjects((json as any)[key]);
    }
  }
  return [];
};
const normalizeFromCsv = (rows: Array<Record<string,string>>): Row[] => normalizeObjects(rows);

// ---- HTML table (Farside) ---------------------------------------------------
function normalizeFarsideHtml(html: string): Row[] {
  // Look for data tables, not navigation/header tables
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let table = null;
  
  // Find the table that contains actual data (has date-like content)
  for (const match of tableMatches) {
    if (match.includes('2024-') || match.includes('2025-') || match.includes('Date') || match.includes('Total')) {
      table = match;
      break;
    }
  }
  
  if (!table) return [];
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellText = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').trim();

  const parsed: string[][] = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => cellText(m[2]));
    if (cells.length) parsed.push(cells);
  }
  if (parsed.length < 2) return [];

  const header = parsed[0].map(h => h.toLowerCase());
  const dateCol = 0;
  const hasTotalCol = header.some(h => h.includes('total'));
  const hdr = header.join(' ');
  const scale =
    /\$bn|us\$bn/i.test(hdr) ? 1e9 :
    /\$m|us\$m|\(us\$m\)|\(\$m\)/i.test(hdr) ? 1e6 : 1;

  const out: Row[] = [];
  
  // More flexible date parsing - handle various formats
  const parseDate = (s: string): string | null => {
    const cleaned = s.trim().replace(/\s+/g, ' ');

    // ISO first
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

    // DD Mon YYYY (e.g., 11 Jan 2024)
    const m1 = cleaned.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
    if (m1) {
      const [, d, mon, y] = m1;
      const mm: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
      return `${y}-${mm[mon.toLowerCase()]}-${d.padStart(2,'0')}`;
    }

    // Slash dates: try to infer by value
    const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) {
      let [_, a, b, y] = m2;
      const A = parseInt(a,10), B = parseInt(b,10);
      // If first > 12, it must be DD/MM; if second > 12, it must be MM/DD
      // If both <= 12, default to MM/DD (US style) unless you prefer EU default.
      if (A > 12 && B <= 12) { // DD/MM
        return `${y}-${String(B).padStart(2,'0')}-${String(A).padStart(2,'0')}`;
      } else if (B > 12 && A <= 12) { // MM/DD
        return `${y}-${String(A).padStart(2,'0')}-${String(B).padStart(2,'0')}`;
      } else {
        // both <= 12 → pick a convention (US default here)
        return `${y}-${String(A).padStart(2,'0')}-${String(B).padStart(2,'0')}`;
      }
    }

    return null;
  };

  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i];
    const dateRaw = (cells[dateCol] || '').trim();
    const date = parseDate(dateRaw);
    if (!date) continue; // skip "Total" or header-ish rows

    let flow = NaN;
    if (hasTotalCol) {
      const idx = header.findIndex(h => h.includes('total'));
      const v = toNum(cells[idx]);
      if (Number.isFinite(v)) flow = v * scale;
    }
    if (!Number.isFinite(flow)) {
      let s = 0, any = false;
      for (let c = 1; c < cells.length; c++) {
        const v = toNum(cells[c]);
        if (Number.isFinite(v)) { s += v; any = true; }
      }
      if (any) flow = s * scale;
    }

    if (Number.isFinite(flow)) out.push({ date, flow });
  }

  const map = new Map<string, number>();
  for (const r of out) map.set(r.date, (map.get(r.date) ?? 0) + r.flow);
  return [...map.entries()].map(([date, flow]) => ({ date, flow }));
}

// ---- CSV discovery inside HTML ---------------------------------------------
function discoverCsvUrls(html: string, base: string): string[] {
  const candidates = new Set<string>();
  const push = (u: string, why: string) => {
    try { candidates.add(new URL(decodeEntities(u), base).toString() + `#via=${why}`); } catch {}
  };

  for (const m of html.matchAll(/href\s*=\s*["']([^"']+?\.csv[^"']*)["']/gi)) push(m[1], "href");
  for (const m of html.matchAll(/(?:https?:\/\/|\/)[^"' )]+?\.csv(?:\?[^"' )]*)?/gi)) push(m[0], "literal");
  for (const m of html.matchAll(/fetch\(['"]([^'"]+?\.csv[^'"]*)/gi)) push(m[1], "fetch");
  for (const m of html.matchAll(/(?:https?:\/\/|\/)[^"' )]+?(?:\?|&)(?:format|download|output|tqx)=?(?:csv|out:csv)[^"' )]*/gi)) push(m[0], "query");
  for (const m of html.matchAll(/(?:https?:\/\/|\/)[^"' )]+?\?[^"' )]*tablepress=[^"' )]*&[^"' )]*file=csv[^"' )]*/gi)) push(m[0], "tablepress");
  for (const m of html.matchAll(/https:\/\/docs\.google\.com\/spreadsheets\/[^"' )]+?(?:tqx=out:csv|output=csv)[^"' )]*/gi)) push(m[0], "sheets");

  return [...candidates];
}

// ---- JSON-in-script extraction ---------------------------------------------
function extractJsonArraysFromScripts(html: string): any[][] {
  const out: any[][] = [];
  // Only non-src <script> bodies
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const cand: string[] = [];

  // 1) var/const/let data = [ ... ];
  for (const s of scripts) {
    for (const m of s.matchAll(/(?:var|let|const)\s+\w+\s*=\s*(\[[\s\S]*?\]);/g)) {
      cand.push(m[1]);
    }
  }
  // 2) Any [ ... ] that obviously contains date fields
  for (const s of scripts) {
    for (const m of s.matchAll(/\[[\s\S]*?"date"\s*:\s*"\d{4}-\d{2}-\d{2}"[\s\S]*?\]/g)) {
      cand.push(m[0]);
    }
  }

  for (const raw of cand) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) out.push(arr);
    } catch {/* ignore */}
  }
  return out;
}

// ---- preformatted CSV in HTML ----------------------------------------------
function extractPreCsv(html: string): string | null {
  const m = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  return m ? m[1] : null;
}

// ---- misc helpers -----------------------------------------------------------
function rollSum(arr: number[], n: number): number[] {
  const out = new Array(arr.length).fill(NaN);
  let s = 0;
  for (let i=0;i<arr.length;i++){
    s += arr[i];
    if (i >= n) s -= arr[i-n];
    if (i >= n-1) out[i] = s;
  }
  return out;
}

// ---- main -------------------------------------------------------------------
export async function computeEtfFlows() {
  const provenance: Prov[] = [];

  const URL  = (process.env.ETF_FLOWS_URL  || "https://farside.co.uk/bitcoin-etf-flow-all-data/").trim();
  const ALT  = (process.env.ETF_FLOWS_ALT_URL || "https://farside.co.uk/bitcoin-etf-flow/").trim();
  const PATH = (process.env.ETF_FLOWS_PATH || "").trim();

  let parsedRows: Row[] = [];
  let sourceNote = "Custom ETF flows";

  // A) Local path
  if (PATH) {
    try {
      const abs = path.isAbsolute(PATH) ? PATH : path.join(process.cwd(), PATH);
      const t0 = Date.now();
      const raw = await fs.readFile(abs, "utf8");
      provenance.push({ url: `file://${abs}`, ok: true, status: 200, ms: Date.now() - t0, note: "read_file" });
      const maybeJson = tryParseJson(raw);
      parsedRows = maybeJson ? normalizeFromJson(maybeJson) : normalizeFromCsv(parseCsv(raw));
      sourceNote = "Local CSV/JSON";
    } catch (e:any) {
      provenance.push({ url: `file://${PATH}`, ok: false, status: 0, ms: 0, error: e?.message ?? String(e), note: "file_read_failed" });
      return { score: null, last_utc: null, source: null, details: [], provenance, reason: "file_read_failed" };
    }
  }

  // Helper: parse from HTML body using multiple strategies
  const parseFromHtmlBody = async (body: string, baseUrl: string) => {
    // quickly detect common CF challenge pages
    const lower = body.toLowerCase();
    if (lower.includes("cf-chl") || lower.includes("cloudflare") && lower.includes("enable javascript")) {
      return { rows: [] as Row[], note: "cloudflare_challenge" };
    }

    // 1) CSV candidates
    const csvs = discoverCsvUrls(body, baseUrl);
    if (csvs.length) {
      for (const tagged of csvs) {
        const [csvUrl, via] = tagged.split("#via=");
        const csv = await fetchRaw(csvUrl, provenance);
        if (!csv) continue;
        const rows = normalizeFromCsv(parseCsv(csv));
        provenance.push({ url: "inline:csv-parse", ok: rows.length>0, status: 200, ms: 0, note: `via=${via} rows=${rows.length}` });
        if (rows.length) return { rows, note: `CSV via ${via}` };
      }
      provenance.push({ url: "inline:csv-candidates", ok: false, status: 200, ms: 0, note: `tried=${csvs.length}` });
    } else {
      provenance.push({ url: "inline:csv-candidates", ok: false, status: 200, ms: 0, note: "none_found" });
    }

    // 2) JSON arrays in <script>
    const jsonArrays = extractJsonArraysFromScripts(body);
    if (jsonArrays.length) {
      for (const arr of jsonArrays) {
        const rows = normalizeFromJson(arr);
        provenance.push({ url: "inline:json-in-script", ok: rows.length>0, status: 200, ms: 0, note: `rows=${rows.length}` });
        if (rows.length) return { rows, note: "JSON in <script>" };
      }
    } else {
      provenance.push({ url: "inline:json-in-script", ok: false, status: 200, ms: 0, note: "none_found" });
    }

    // 3) <pre> CSV
    const pre = extractPreCsv(body);
    if (pre) {
      const rows = normalizeFromCsv(parseCsv(pre));
      provenance.push({ url: "inline:pre-csv", ok: rows.length>0, status: 200, ms: 0, note: `rows=${rows.length}` });
      if (rows.length) return { rows, note: "<pre> CSV" };
    } else {
      provenance.push({ url: "inline:pre-csv", ok: false, status: 200, ms: 0, note: "none_found" });
    }

    // 4) HTML table
    const htmlRows = normalizeFarsideHtml(body);
    provenance.push({ url: "inline:html-table-parse", ok: htmlRows.length>0, status: 200, ms: 0, note: `html_rows=${htmlRows.length}` });
    if (htmlRows.length) return { rows: htmlRows, note: "HTML table parsed" };
    
    // Debug: log a sample of the HTML if no rows found (dev only)
    if (htmlRows.length === 0 && process.env.NODE_ENV !== 'production') {
      console.log('ETF Flows: No HTML table rows found. Sample HTML:', body.slice(0, 1000));
    }

    return { rows: [] as Row[], note: "no_csv_json_or_table" };
  };

  // B) Remote URL
  if (!parsedRows.length && URL) {
    const body = await fetchRaw(URL, provenance);
    if (body) {
      const maybeJson = tryParseJson(body);
      if (maybeJson) {
        parsedRows = normalizeFromJson(maybeJson);
        provenance.push({ url: "inline:json", ok: parsedRows.length>0, status: 200, ms: 0, note: `json_rows=${parsedRows.length}` });
        if (parsedRows.length) sourceNote = "Remote JSON";
      } else if (/^\s*</.test(body)) {
        const { rows, note } = await parseFromHtmlBody(body, URL);
        parsedRows = rows;
        if (rows.length) sourceNote = `Farside (auto: ${note})`;
      } else {
        const rows = normalizeFromCsv(parseCsv(body));
        provenance.push({ url: "inline:csv-parse", ok: rows.length>0, status: 200, ms: 0, note: `csv_rows=${rows.length}` });
        if (rows.length) { parsedRows = rows; sourceNote = "Remote CSV"; }
      }
    } else {
      provenance.push({ url: "inline:url-fetch", ok: false, status: 0, ms: 0, note: "failed" });
    }
  }

  // C) Optional ALT URL fallback
  if (!parsedRows.length && ALT) {
    const body = await fetchRaw(ALT, provenance);
    if (body) {
      const maybeJson = tryParseJson(body);
      if (maybeJson) {
        const rows = normalizeFromJson(maybeJson);
        provenance.push({ url: "inline:alt-json", ok: rows.length>0, status: 200, ms: 0, note: `rows=${rows.length}` });
        if (rows.length) { parsedRows = rows; sourceNote = "ALT JSON"; }
      } else if (/^\s*</.test(body)) {
        const { rows, note } = await parseFromHtmlBody(body, ALT);
        provenance.push({ url: "inline:alt-html", ok: rows.length>0, status: 200, ms: 0, note });
        if (rows.length) { parsedRows = rows; sourceNote = `ALT HTML (${note})`; }
      } else {
        const rows = normalizeFromCsv(parseCsv(body));
        provenance.push({ url: "inline:alt-csv", ok: rows.length>0, status: 200, ms: 0, note: `rows=${rows.length}` });
        if (rows.length) { parsedRows = rows; sourceNote = "ALT CSV"; }
      }
    }
  }

  if (!parsedRows.length) {
    console.log('ETF Flows: No rows parsed. Provenance:', JSON.stringify(provenance, null, 2));
    return { score: null, last_utc: null, source: null, details: [], provenance, reason: "parse_produced_no_rows" };
  }

  // ensure only valid ISO dates
  parsedRows = parsedRows.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

  // Sort & clamp
  parsedRows.sort((a,b)=> a.date < b.date ? -1 : 1);
  const end = parsedRows.at(-1)!.date;
  const recent = parsedRows.slice(Math.max(0, parsedRows.length - 220));
  const flow = recent.map(r => r.flow);

  // 21d momentum
  const m21 = rollSum(flow, 21);
  const latest21 = m21.at(-1)!;
  const series21 = m21.filter(Number.isFinite) as number[];
  
  // Check for insufficient window
  if (series21.length === 0) {
    return { score: null, last_utc: `${end}T00:00:00.000Z`, source: sourceNote,
             details: [], provenance, reason: "insufficient_window" };
  }
  
  const pr21 = percentileRank(series21, latest21);
  const s_momentum = Math.round(100 * logistic01(1 - pr21, 3));
  const score = Number.isFinite(s_momentum) ? s_momentum : null;

  const fmtCompactUsd = (n:number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);

  return {
    score,
    last_utc: `${end}T00:00:00.000Z`,
    source: sourceNote,
    details: [
      { label: "Net flow (21d sum)", value: Number.isFinite(latest21) ? fmtCompactUsd(latest21 as number) : "—" },
      { label: "Window (days)", value: series21.length },
      { label: "Rows (recent)", value: recent.length },
    ],
    provenance,
  };
}
