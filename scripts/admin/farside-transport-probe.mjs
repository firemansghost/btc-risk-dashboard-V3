#!/usr/bin/env node
/**
 * Disposable Farside transport / payload-shape probe.
 * No ETF parsing, scoring, cache writes, or production repair.
 */

import { createHash } from 'node:crypto';

const HTML_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

const JSON_HEADERS = {
  'User-Agent': HTML_HEADERS['User-Agent'],
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

const TIMEOUT_MS = 30000;

const TARGETS = [
  {
    id: 'existing_html',
    url: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
    headers: HTML_HEADERS,
    shape: 'html',
  },
  {
    id: 'fallback_bitcoin_etf_flow',
    url: 'https://farside.co.uk/bitcoin-etf-flow/',
    headers: HTML_HEADERS,
    shape: 'html',
  },
  {
    id: 'fallback_etf_flows',
    url: 'https://farside.co.uk/etf-flows/',
    headers: HTML_HEADERS,
    shape: 'html',
  },
  {
    id: 'fallback_etf_flows_btc',
    url: 'https://farside.co.uk/etf-flows/btc',
    headers: HTML_HEADERS,
    shape: 'html',
  },
  {
    id: 'btc_page',
    url: 'https://farside.co.uk/btc/',
    headers: HTML_HEADERS,
    shape: 'html',
  },
  {
    id: 'wordpress_rest',
    url: 'https://farside.co.uk/wp-json/wp/v2/pages/1321',
    headers: JSON_HEADERS,
    shape: 'wordpress',
  },
];

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function yn(value) {
  return value ? 'YES' : 'NO';
}

function structuralMarkers(text) {
  return {
    sha256: sha256(text),
    chars: text.length,
    bytes: Buffer.byteLength(text, 'utf8'),
    hasTable: text.includes('<table'),
    hasTotal: text.includes('Total'),
    hasIbit: text.includes('IBIT'),
    hasFbtc: text.includes('FBTC'),
    hasBtc: text.includes('BTC'),
  };
}

function failureClass(error) {
  const name = error && error.name ? error.name : 'Error';
  const message = error && error.message ? String(error.message) : String(error);
  return `${name}: ${message.slice(0, 180)}`;
}

async function probe(target) {
  const started = Date.now();
  const record = {
    id: target.id,
    requestedUrl: target.url,
    finalUrl: null,
    status: null,
    contentType: null,
    bytes: null,
    elapsedMs: null,
    fetchSucceeded: false,
    failure: null,
  };
  try {
    const response = await fetch(target.url, {
      headers: target.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = Buffer.from(await response.arrayBuffer());
    record.elapsedMs = Date.now() - started;
    record.finalUrl = response.url;
    record.status = response.status;
    record.contentType = response.headers.get('content-type');
    record.bytes = body.length;
    record.fetchSucceeded = response.ok;
    if (!response.ok) {
      record.failure = `http_${response.status}`;
      return record;
    }
    const text = body.toString('utf8');
    if (target.shape === 'html') {
      record.html = structuralMarkers(text);
    } else {
      try {
        const parsed = JSON.parse(text);
        const rendered = parsed?.content?.rendered;
        const renderedText = typeof rendered === 'string' ? rendered : null;
        record.wordpress = {
          jsonValid: true,
          id: parsed?.id ?? null,
          slug: parsed?.slug ?? null,
          link: parsed?.link ?? null,
          title: typeof parsed?.title?.rendered === 'string' ? parsed.title.rendered.slice(0, 200) : null,
          renderedPresent: renderedText != null,
          renderedChars: renderedText ? renderedText.length : 0,
          renderedBytes: renderedText ? Buffer.byteLength(renderedText, 'utf8') : 0,
          renderedSha256: renderedText ? sha256(renderedText) : null,
          hasTable: renderedText ? renderedText.includes('<table') : false,
          hasTotal: renderedText ? renderedText.includes('Total') : false,
          hasIbit: renderedText ? renderedText.includes('IBIT') : false,
          hasFbtc: renderedText ? renderedText.includes('FBTC') : false,
          hasBtc: renderedText ? renderedText.includes('BTC') : false,
        };
      } catch (error) {
        record.wordpress = {
          jsonValid: false,
          failure: failureClass(error),
        };
      }
    }
  } catch (error) {
    record.elapsedMs = Date.now() - started;
    record.failure = failureClass(error);
  }
  return record;
}

function verdict(records) {
  const byId = Object.fromEntries(records.map((record) => [record.id, record]));
  const wordpress = byId.wordpress_rest?.wordpress;
  return {
    existing_html_reachable: yn(byId.existing_html?.fetchSucceeded),
    btc_page_reachable: yn(byId.btc_page?.fetchSucceeded),
    wordpress_rest_reachable: yn(byId.wordpress_rest?.fetchSucceeded),
    wordpress_json_valid: yn(wordpress?.jsonValid),
    wordpress_rendered_content_present: yn(wordpress?.renderedPresent),
    wordpress_rendered_table_present: yn(wordpress?.hasTable),
  };
}

const records = [];
for (const target of TARGETS) {
  const record = await probe(target);
  records.push(record);
  console.log(JSON.stringify(record));
}

const summary = verdict(records);
console.log('FARSIDE TRANSPORT PROBE');
for (const [key, value] of Object.entries(summary)) {
  console.log(`${key}: ${value}`);
}
