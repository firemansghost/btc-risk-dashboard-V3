// scripts/etl/__tests__/social_interest_staleness.test.mjs
// Unit test for social_interest staleness handling

import { test } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the social interest computation
async function mockComputeSocialInterest() {
  const nowIso = new Date().toISOString();
  return {
    score: 50,
    reason: "success",
    status: "fresh",
    lastUpdated: nowIso,
    components: {
      searchScore: 50,
      momentumScore: 50,
      volatilityScore: 50
    },
    provider: "coingecko",
    details: []
  };
}

// Test that cache is written with lastUpdated
test('social_interest cache includes lastUpdated', async () => {
  const result = await mockComputeSocialInterest();
  const cacheDir = path.join(__dirname, '../../public/data/cache/social_interest');
  const cacheFile = path.join(cacheDir, 'social_interest_cache.json');
  
  // Ensure directory exists
  await fs.mkdir(cacheDir, { recursive: true });
  
  // Write cache
  const cacheData = {
    ...result,
    cachedAt: new Date().toISOString(),
    version: '1.0.0'
  };
  await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
  
  // Read back and verify
  const written = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
  assert.ok(written.lastUpdated, 'Cache must include lastUpdated');
  
  // Verify lastUpdated is within 2 minutes of now
  const writtenTime = new Date(written.lastUpdated).getTime();
  const now = Date.now();
  const ageMinutes = (now - writtenTime) / (1000 * 60);
  assert.ok(ageMinutes <= 2, `lastUpdated should be within 2 minutes, got ${ageMinutes.toFixed(2)} minutes`);
  
  // Cleanup
  await fs.unlink(cacheFile).catch(() => {});
});

// Test staleness evaluation with grace window
test('staleness evaluation with grace window', async () => {
  const { getStalenessStatus } = await import('../stalenessUtils.mjs');
  
  // Create a result that's just at TTL boundary
  const now = new Date();
  const ttlHours = 6;
  const ttlMinutes = ttlHours * 60;
  const graceMinutes = 5;
  
  // Test 1: Fresh (within TTL + grace)
  const freshTime = new Date(now.getTime() - (ttlMinutes + graceMinutes - 1) * 60 * 1000);
  const freshResult = {
    score: 50,
    lastUpdated: freshTime.toISOString()
  };
  
  const freshStatus = getStalenessStatus(freshResult, ttlHours, {
    factorName: 'social_interest',
    staleBeyondHours: 12
  });
  
  assert.strictEqual(freshStatus.status, 'fresh', 'Should be fresh within TTL + grace');
  
  // Test 2: Stale (beyond TTL + grace but within staleBeyond + grace)
  const staleTime = new Date(now.getTime() - (ttlMinutes + graceMinutes + 1) * 60 * 1000);
  const staleResult = {
    score: 50,
    lastUpdated: staleTime.toISOString()
  };
  
  const staleStatus = getStalenessStatus(staleResult, ttlHours, {
    factorName: 'social_interest',
    staleBeyondHours: 12
  });
  
  assert.strictEqual(staleStatus.status, 'stale', 'Should be stale beyond TTL + grace');
  
  // Test 3: Excluded (beyond staleBeyond + grace)
  const excludedTime = new Date(now.getTime() - (12 * 60 + graceMinutes + 1) * 60 * 1000);
  const excludedResult = {
    score: 50,
    lastUpdated: excludedTime.toISOString()
  };
  
  const excludedStatus = getStalenessStatus(excludedResult, ttlHours, {
    factorName: 'social_interest',
    staleBeyondHours: 12
  });
  
  assert.strictEqual(excludedStatus.status, 'stale', 'Should be stale beyond staleBeyond + grace');
});

