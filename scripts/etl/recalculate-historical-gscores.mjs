#!/usr/bin/env node
/**
 * Recalculate Historical G-Scores Script
 * 
 * This script recalculates all historical G-Scores using the new dynamic
 * factor baselines to fix the static G-Score issue.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Load factor data from CSV
 */
async function loadFactorData(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      return [];
    }
    
    const header = lines[0].split(',');
    const records = lines.slice(1).map(line => {
      const values = line.split(',');
      const record = {};
      header.forEach((col, i) => {
        record[col.trim()] = values[i]?.trim() || '';
      });
      return record;
    });
    
    return records;
  } catch (error) {
    console.log(`Warning: Could not load ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Calculate Z-score from historical data
 */
function calculateZScore(value, historicalData) {
  if (historicalData.length === 0) return 0;
  
  const values = historicalData.map(d => parseFloat(d)).filter(v => !isNaN(v));
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

/**
 * Calculate risk score from percentile
 */
function riskFromPercentile(percentile, options = {}) {
  const { invert = false, k = 2 } = options;
  
  // Normalize percentile to 0-100 scale
  let normalized = Math.max(0, Math.min(100, percentile));
  
  // Apply inversion if needed
  if (invert) {
    normalized = 100 - normalized;
  }
  
  // Apply k-factor scaling (higher k = more extreme scores)
  const scaled = Math.pow(normalized / 100, k) * 100;
  
  return Math.round(scaled);
}

/**
 * Recalculate G-Scores with new factor baselines
 */
async function recalculateHistoricalGScores() {
  console.log('🔄 Recalculating Historical G-Scores');
  console.log('=====================================');
  
  try {
    // Load price history
    console.log('📈 Loading price history...');
    const priceContent = await fs.readFile('public/data/history.csv', 'utf8');
    const priceLines = priceContent.trim().split('\n');
    const priceRecords = priceLines.slice(1).map(line => {
      const [date, score, band, price] = line.split(',');
      return {
        date: date.trim(),
        score: parseFloat(score),
        band: band.trim(),
        price: parseFloat(price)
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`📊 Found ${priceRecords.length} price records`);
    
    // Load factor data
    console.log('📊 Loading factor data...');
    const mayerData = await loadFactorData('public/signals/mayer_multiple.csv');
    const dxyData = await loadFactorData('public/signals/dxy_20d.csv');
    const fearGreedData = await loadFactorData('public/signals/fear_greed.csv');
    
    console.log(`📊 Mayer Multiple: ${mayerData.length} records`);
    console.log(`📊 DXY: ${dxyData.length} records`);
    console.log(`📊 Fear & Greed: ${fearGreedData.length} records`);
    
    // Create factor lookup maps
    const mayerMap = new Map(mayerData.map(d => [d.date, d]));
    const dxyMap = new Map(dxyData.map(d => [d.date, d]));
    const fearGreedMap = new Map(fearGreedData.map(d => [d.date, d]));
    
    // Recalculate G-Scores
    console.log('🧮 Recalculating G-Scores...');
    const newGScores = [];
    let recalculatedCount = 0;
    
    for (const priceRecord of priceRecords) {
      const date = priceRecord.date;
      const mayer = mayerMap.get(date);
      const dxy = dxyMap.get(date);
      const fearGreed = fearGreedMap.get(date);
      
      // Calculate new G-Score if we have factor data
      if (mayer && dxy && fearGreed) {
        // Extract values
        const mayerValue = parseFloat(mayer.mayer);
        const dxyValue = parseFloat(dxy.dxy_delta20d);
        const fearGreedValue = parseFloat(fearGreed.fng_value);
        
        // Calculate Z-scores using historical baselines
        const mayerZ = calculateZScore(mayerValue, mayerData.map(d => parseFloat(d.mayer)));
        const dxyZ = calculateZScore(dxyValue, dxyData.map(d => parseFloat(d.dxy_delta20d)));
        const fearGreedZ = calculateZScore(fearGreedValue, fearGreedData.map(d => parseFloat(d.fng_value)));
        
        // Calculate factor scores (simplified)
        const mayerScore = riskFromPercentile(Math.abs(mayerZ) * 50 + 50, { invert: false });
        const dxyScore = riskFromPercentile(Math.abs(dxyZ) * 50 + 50, { invert: false });
        const fearGreedScore = riskFromPercentile(Math.abs(fearGreedZ) * 50 + 50, { invert: false });
        
        // Weighted composite (simplified weights)
        const composite = (mayerScore * 0.4 + dxyScore * 0.3 + fearGreedScore * 0.3);
        
        // Determine band
        let band = 'Hold & Wait';
        if (composite < 15) band = 'Aggressive Buying';
        else if (composite < 35) band = 'Regular DCA Buying';
        else if (composite < 50) band = 'Moderate Buying';
        else if (composite < 65) band = 'Hold & Wait';
        else if (composite < 80) band = 'Reduce Risk';
        else band = 'High Risk';
        
        newGScores.push({
          date,
          score: Math.round(composite),
          band,
          price: priceRecord.price,
          mayerZ: mayerZ.toFixed(2),
          dxyZ: dxyZ.toFixed(2),
          fearGreedZ: fearGreedZ.toFixed(2)
        });
        
        recalculatedCount++;
      } else {
        // Keep original data if no factor data available
        newGScores.push(priceRecord);
      }
    }
    
    // Save updated history
    console.log('💾 Saving updated G-Score history...');
    const header = 'date,score,band,price_usd';
    const lines = [header, ...newGScores.map(r => `${r.date},${r.score},${r.band},${r.price.toFixed(2)}`)];
    await fs.writeFile('public/data/history.csv', lines.join('\n'));
    
    // Analysis
    const scores = newGScores.map(r => r.score);
    const uniqueScores = new Set(scores).size;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    
    console.log('\n📋 Recalculation Summary');
    console.log('========================');
    console.log(`📊 Total records: ${newGScores.length}`);
    console.log(`🔄 Recalculated: ${recalculatedCount}`);
    console.log(`📈 Score range: ${minScore} - ${maxScore}`);
    console.log(`📊 Average score: ${avgScore.toFixed(1)}`);
    console.log(`🎯 Unique scores: ${uniqueScores} (${(uniqueScores/scores.length*100).toFixed(1)}%)`);
    
    // Check for improvement
    const diversityScore = (uniqueScores / scores.length) * 100;
    if (diversityScore > 20) {
      console.log('✅ G-Score diversity significantly improved!');
    } else if (diversityScore > 10) {
      console.log('⚠️  G-Score diversity moderately improved');
    } else {
      console.log('❌ G-Score diversity still low - may need more factor data');
    }
    
    console.log('\n✅ Historical G-Score recalculation complete!');
    
    return {
      totalRecords: newGScores.length,
      recalculatedCount,
      uniqueScores,
      diversityScore
    };
    
  } catch (error) {
    console.error('❌ Recalculation failed:', error.message);
    throw error;
  }
}

// Run the recalculation
recalculateHistoricalGScores().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
