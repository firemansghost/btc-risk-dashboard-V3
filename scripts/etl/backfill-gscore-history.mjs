#!/usr/bin/env node
/**
 * Historical G-Score Backfill Script
 * 
 * This script backfills historical G-Scores using existing price data and
 * factor calculations for dates where we have price history but no G-Score.
 * 
 * Features:
 * - Uses btc_price_history.csv (729+ days of data)
 * - Calculates factors for each historical date
 * - Assigns appropriate risk bands
 * - Preserves existing G-Score data
 * - Validates data quality
 */

import fs from 'fs/promises';
import path from 'path';

// Import factor computation functions
import { computeAllFactors } from './factors.mjs';
import { loadPriceHistory } from './priceHistory.mjs';

// Risk band calculation (from compute.mjs)
function riskBand(score) {
  if (score < 15) return { name: "Aggressive Buying", lo: 0, hi: 15 };
  if (score < 35) return { name: "Regular DCA Buying", lo: 15, hi: 35 };
  if (score < 50) return { name: "Moderate Buying", lo: 35, hi: 50 };
  if (score < 65) return { name: "Hold & Wait", lo: 50, hi: 65 };
  if (score < 80) return { name: "Reduce Risk", lo: 65, hi: 80 };
  return { name: "High Risk", lo: 80, hi: 100 };
}

/**
 * Load existing G-Score history
 */
async function loadExistingHistory() {
  try {
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) return new Set(); // No data or just header
    
    const existingDates = new Set();
    for (let i = 1; i < lines.length; i++) { // Skip header
      const date = lines[i].split(',')[0];
      if (date) existingDates.add(date);
    }
    
    return existingDates;
  } catch (error) {
    console.log('No existing history found, starting fresh');
    return new Set();
  }
}

/**
 * Save G-Score history with deduplication
 */
async function saveHistory(historyData) {
  const header = "date,score,band,price_usd";
  const lines = [header];
  
  // Sort by date
  const sortedData = historyData.sort((a, b) => a.date.localeCompare(b.date));
  
  for (const record of sortedData) {
    lines.push(`${record.date},${record.score},${record.band},${record.price.toFixed(2)}`);
  }
  
  await fs.writeFile('public/data/history.csv', lines.join('\n'));
  console.log(`💾 Saved ${historyData.length} G-Score records to history.csv`);
}

/**
 * Calculate G-Score for a specific historical date
 */
async function calculateHistoricalGScore(date, price) {
  try {
    console.log(`📊 Calculating G-Score for ${date} (Price: $${price.toFixed(2)})`);
    
    // Compute factors for this historical date
    const factorResults = await computeAllFactors(price);
    
    if (!factorResults || factorResults.composite === null) {
      console.warn(`⚠️  Could not calculate factors for ${date}`);
      return null;
    }
    
    const composite = factorResults.composite;
    const band = riskBand(composite);
    
    return {
      date,
      score: composite,
      band: band.name,
      price,
      factors: factorResults.factors,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Error calculating G-Score for ${date}:`, error.message);
    return {
      date,
      score: null,
      band: 'Unknown',
      price,
      error: error.message,
      success: false
    };
  }
}

/**
 * Validate G-Score data quality
 */
function validateGScoreData(historyData) {
  console.log('\n🔍 Validating G-Score data quality...');
  
  const issues = [];
  const scores = historyData.filter(r => r.score !== null).map(r => r.score);
  
  if (scores.length === 0) {
    issues.push('No valid scores found');
    return issues;
  }
  
  // Check for too many identical consecutive scores
  let consecutiveIdentical = 0;
  let maxConsecutive = 0;
  let lastScore = null;
  
  for (const record of historyData) {
    if (record.score === lastScore && record.score !== null) {
      consecutiveIdentical++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveIdentical);
    } else {
      consecutiveIdentical = 0;
    }
    lastScore = record.score;
  }
  
  if (maxConsecutive > 5) {
    issues.push(`Too many consecutive identical scores: ${maxConsecutive} days`);
  }
  
  // Check score distribution
  const uniqueScores = new Set(scores);
  const scoreVariation = Math.max(...scores) - Math.min(...scores);
  
  if (uniqueScores.size < scores.length * 0.1) {
    issues.push(`Low score variation: only ${uniqueScores.size} unique scores out of ${scores.length}`);
  }
  
  if (scoreVariation < 10) {
    issues.push(`Very low score range: ${scoreVariation.toFixed(1)} points`);
  }
  
  // Check for null scores
  const nullScores = historyData.filter(r => r.score === null).length;
  if (nullScores > historyData.length * 0.1) {
    issues.push(`High null score rate: ${nullScores}/${historyData.length} (${(nullScores/historyData.length*100).toFixed(1)}%)`);
  }
  
  if (issues.length === 0) {
    console.log('✅ Data quality validation passed');
  } else {
    console.log('⚠️  Data quality issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  return issues;
}

/**
 * Main backfill function
 */
async function backfillHistoricalGScores() {
  console.log('🚀 Starting Historical G-Score Backfill...');
  console.log('=====================================');
  
  try {
  
  // 1. Load existing price history
  console.log('📈 Loading price history...');
  const priceHistory = await loadPriceHistory();
  
  if (priceHistory.length < 100) {
    console.error('❌ Insufficient price history data. Need at least 100 days.');
    return;
  }
  
  console.log(`📊 Found ${priceHistory.length} days of price history`);
  console.log(`📅 Date range: ${priceHistory[0].date_utc} to ${priceHistory[priceHistory.length - 1].date_utc}`);
  
  // 2. Load existing G-Score history
  console.log('\n📋 Loading existing G-Score history...');
  const existingDates = await loadExistingHistory();
  console.log(`📊 Found ${existingDates.size} existing G-Score records`);
  
  // 3. Identify dates needing backfill
  const datesNeedingBackfill = priceHistory
    .filter(record => !existingDates.has(record.date_utc))
    .sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  
  console.log(`📊 Found ${datesNeedingBackfill.length} dates needing G-Score backfill`);
  
  if (datesNeedingBackfill.length === 0) {
    console.log('✅ All dates already have G-Scores. No backfill needed.');
    return;
  }
  
  // 4. Calculate G-Scores for missing dates
  console.log('\n🧮 Calculating G-Scores for missing dates...');
  const newGScores = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < datesNeedingBackfill.length; i++) {
    const record = datesNeedingBackfill[i];
    const progress = `[${i + 1}/${datesNeedingBackfill.length}]`;
    
    console.log(`${progress} Processing ${record.date_utc}...`);
    
    const gscore = await calculateHistoricalGScore(record.date_utc, record.close_usd);
    
    if (gscore && gscore.success) {
      newGScores.push(gscore);
      successCount++;
      console.log(`   ✅ G-Score: ${gscore.score} (${gscore.band})`);
    } else {
      errorCount++;
      console.log(`   ❌ Failed: ${gscore?.error || 'Unknown error'}`);
    }
    
    // Add small delay to avoid overwhelming APIs
    if (i < datesNeedingBackfill.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n📊 Backfill Results:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📈 Success Rate: ${(successCount / datesNeedingBackfill.length * 100).toFixed(1)}%`);
  
  if (newGScores.length === 0) {
    console.log('❌ No new G-Scores calculated. Backfill failed.');
    return;
  }
  
  // 5. Load all existing history and merge
  console.log('\n💾 Merging with existing history...');
  const existingHistory = await loadExistingHistory();
  const allHistory = [...newGScores];
  
  // Add existing records
  try {
    const existingContent = await fs.readFile('public/data/history.csv', 'utf8');
    const existingLines = existingContent.trim().split('\n');
    
    for (let i = 1; i < existingLines.length; i++) { // Skip header
      const parts = existingLines[i].split(',');
      if (parts.length >= 4) {
        allHistory.push({
          date: parts[0],
          score: parseFloat(parts[1]),
          band: parts[2],
          price: parseFloat(parts[3])
        });
      }
    }
  } catch (error) {
    console.log('No existing history to merge');
  }
  
  // 6. Validate data quality
  const qualityIssues = validateGScoreData(allHistory);
  
  // 7. Save updated history
  console.log('\n💾 Saving updated G-Score history...');
  await saveHistory(allHistory);
  
  // 8. Generate summary report
  console.log('\n📋 Backfill Summary Report');
  console.log('==========================');
  console.log(`📊 Total G-Score records: ${allHistory.length}`);
  console.log(`📅 Date range: ${allHistory[0]?.date} to ${allHistory[allHistory.length - 1]?.date}`);
  console.log(`🆕 New records added: ${newGScores.length}`);
  console.log(`📈 Data quality issues: ${qualityIssues.length}`);
  
  if (qualityIssues.length > 0) {
    console.log('\n⚠️  Quality Issues:');
    qualityIssues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  // Show score distribution
  const scores = allHistory.filter(r => r.score !== null).map(r => r.score);
  if (scores.length > 0) {
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    console.log('\n📊 Score Distribution:');
    console.log(`   Min: ${minScore.toFixed(1)}`);
    console.log(`   Max: ${maxScore.toFixed(1)}`);
    console.log(`   Avg: ${avgScore.toFixed(1)}`);
    console.log(`   Range: ${(maxScore - minScore).toFixed(1)} points`);
  }
  
  console.log('\n✅ Historical G-Score backfill complete!');
  
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the backfill if this script is executed directly
console.log('Script starting...');
backfillHistoricalGScores().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});

export { backfillHistoricalGScores };
