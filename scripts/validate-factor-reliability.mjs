#!/usr/bin/env node
// scripts/validate-factor-reliability.mjs
// CI tripwires for factor reliability and consistency

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Freshness parity test
async function testFreshnessParity() {
  try {
    log('blue', '1. Testing freshness parity between UI and System Status...');
    
    const latestPath = path.join(rootDir, 'public/data/latest.json');
    if (!fs.existsSync(latestPath)) {
      log('yellow', '   SKIP: latest.json not found');
      return true;
    }

    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    
    // Import TTL logic from factorUtils (simulate)
    const factorTTLs = {
      'trend_valuation': 24,
      'onchain': 72,
      'stablecoins': 24,
      'etf_flows': 120,
      'net_liquidity': 240,
      'term_structure': 24,
      'macro_overlay': 24,
      'social_interest': 24
    };

    let allMatch = true;
    const now = Date.now();

    for (const factor of latest.factors || []) {
      const ttl = factorTTLs[factor.key] || 24;
      const lastUpdate = new Date(factor.last_utc || latest.as_of_utc).getTime();
      const ageHours = (now - lastUpdate) / (1000 * 60 * 60);
      
      // UI staleness logic
      const uiStatus = ageHours <= ttl ? 'fresh' : (ageHours <= 72 ? 'stale' : 'excluded');
      const etlStatus = factor.status;
      
      if (uiStatus !== etlStatus) {
        log('red', `   MISMATCH: ${factor.label} - UI: ${uiStatus}, ETL: ${etlStatus} (${ageHours.toFixed(1)}h old, TTL: ${ttl}h)`);
        allMatch = false;
      }
    }

    if (allMatch) {
      log('green', '   PASS: Freshness parity test');
      return true;
    } else {
      log('red', '   FAIL: Freshness parity test');
      return false;
    }
  } catch (error) {
    log('red', `   ERROR: Freshness parity test - ${error.message}`);
    return false;
  }
}

// Test 2: ETL import hygiene
async function testETLImportHygiene() {
  try {
    log('blue', '2. Testing ETL import hygiene (no .ts imports)...');
    
    const etlDir = path.join(rootDir, 'scripts/etl');
    if (!fs.existsSync(etlDir)) {
      log('yellow', '   SKIP: ETL directory not found');
      return true;
    }

    const etlFiles = fs.readdirSync(etlDir, { recursive: true })
      .filter(file => file.endsWith('.mjs') || file.endsWith('.js'))
      .map(file => path.join(etlDir, file));

    let hasTypeScriptImports = false;

    for (const filePath of etlFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for .ts imports
      const tsImportRegex = /import.*from\s+['"`][^'"`]*\.ts['"`]/g;
      const matches = content.match(tsImportRegex);
      
      if (matches) {
        log('red', `   FAIL: Found .ts import in ${path.relative(rootDir, filePath)}: ${matches[0]}`);
        hasTypeScriptImports = true;
      }
    }

    if (!hasTypeScriptImports) {
      log('green', '   PASS: No ETL .ts imports');
      return true;
    } else {
      log('red', '   FAIL: ETL import hygiene test');
      return false;
    }
  } catch (error) {
    log('red', `   ERROR: ETL import hygiene test - ${error.message}`);
    return false;
  }
}

// Test 3: Unit consistency (mempool MB)
async function testUnitConsistency() {
  try {
    log('blue', '3. Testing unit consistency (mempool MB)...');
    
    const latestPath = path.join(rootDir, 'public/data/latest.json');
    if (!fs.existsSync(latestPath)) {
      log('yellow', '   SKIP: latest.json not found');
      return true;
    }

    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    const onchainFactor = latest.factors?.find(f => f.key === 'onchain');
    
    if (!onchainFactor) {
      log('yellow', '   SKIP: On-chain factor not found');
      return true;
    }

    const mempoolDetail = onchainFactor.details?.find(d => d.label.includes('Mempool'));
    
    if (!mempoolDetail) {
      log('yellow', '   SKIP: Mempool detail not found');
      return true;
    }

    const mempoolValue = mempoolDetail.value;
    
    // Check if value is in reasonable MB range (0.1 to 1000 MB)
    const mempoolMatch = mempoolValue.match(/^(\d+(?:\.\d+)?)\s*MB$/);
    
    if (!mempoolMatch) {
      log('red', `   FAIL: Mempool value not in MB format: "${mempoolValue}"`);
      return false;
    }

    const mempoolMB = parseFloat(mempoolMatch[1]);
    
    if (mempoolMB < 0.1 || mempoolMB > 1000) {
      log('red', `   FAIL: Mempool value out of reasonable range: ${mempoolMB} MB`);
      return false;
    }

    log('green', `   PASS: Mempool unit consistency (${mempoolValue})`);
    return true;
  } catch (error) {
    log('red', `   ERROR: Unit consistency test - ${error.message}`);
    return false;
  }
}

// Main validation runner
async function main() {
  log('blue', '🔍 Factor Reliability & Consistency Validation');
  log('blue', '==============================================');
  
  const results = await Promise.all([
    testFreshnessParity(),
    testETLImportHygiene(),
    testUnitConsistency()
  ]);

  const allPassed = results.every(result => result);
  
  console.log('');
  log('blue', 'Summary:');
  log(allPassed ? 'green' : 'red', `Overall: ${allPassed ? 'PASS' : 'FAIL'}`);
  
  if (!allPassed) {
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(error => {
    log('red', `Fatal error: ${error.message}`);
    process.exit(1);
  });
} else {
  // Always run for now during development
  main().catch(error => {
    log('red', `Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export { testFreshnessParity, testETLImportHygiene, testUnitConsistency };
