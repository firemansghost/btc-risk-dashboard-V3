#!/usr/bin/env node
/**
 * Simple G-Score Backfill Script
 * 
 * This script works with the existing history.csv data to:
 * - Validate the current G-Score data
 * - Identify any gaps or issues
 * - Provide a summary of the historical data
 */

import fs from 'fs/promises';

/**
 * Load and analyze existing G-Score history
 */
async function analyzeGScoreHistory() {
  console.log('🔍 Analyzing Existing G-Score History');
  console.log('=====================================');
  
  try {
    // Load current history
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      console.log('❌ No G-Score history found');
      return;
    }
    
    const header = lines[0];
    const dataLines = lines.slice(1);
    
    console.log(`📊 Found ${dataLines.length} G-Score records`);
    
    // Parse data
    const records = dataLines.map(line => {
      const [date, score, band, price] = line.split(',');
      return {
        date: date.trim(),
        score: score === 'null' || score === '' ? null : parseFloat(score),
        band: band.trim(),
        price: parseFloat(price)
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    // Analyze data
    const validScores = records.filter(r => r.score !== null);
    const nullScores = records.filter(r => r.score === null);
    
    console.log(`✅ Valid scores: ${validScores.length}`);
    console.log(`❌ Null scores: ${nullScores.length}`);
    
    if (records.length > 0) {
      console.log(`📅 Date range: ${records[0].date} to ${records[records.length - 1].date}`);
    }
    
    // Check for consecutive identical scores
    let consecutiveIdentical = 0;
    let maxConsecutive = 0;
    let lastScore = null;
    
    for (const record of records) {
      if (record.score === lastScore && record.score !== null) {
        consecutiveIdentical++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveIdentical);
      } else {
        consecutiveIdentical = 0;
      }
      lastScore = record.score;
    }
    
    if (maxConsecutive > 5) {
      console.log(`⚠️  Warning: ${maxConsecutive} consecutive identical scores found`);
    } else {
      console.log(`✅ No suspicious consecutive identical scores`);
    }
    
    // Score statistics
    if (validScores.length > 0) {
      const scores = validScores.map(r => r.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const uniqueScores = new Set(scores).size;
      
      console.log('\n📊 Score Statistics:');
      console.log(`   Min: ${minScore.toFixed(1)}`);
      console.log(`   Max: ${maxScore.toFixed(1)}`);
      console.log(`   Avg: ${avgScore.toFixed(1)}`);
      console.log(`   Unique: ${uniqueScores} out of ${scores.length}`);
      console.log(`   Range: ${(maxScore - minScore).toFixed(1)} points`);
    }
    
    // Band distribution
    const bandCounts = {};
    records.forEach(r => {
      if (r.band) {
        bandCounts[r.band] = (bandCounts[r.band] || 0) + 1;
      }
    });
    
    console.log('\n🏷️  Band Distribution:');
    Object.entries(bandCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([band, count]) => {
        const percentage = (count / records.length * 100).toFixed(1);
        console.log(`   ${band}: ${count} (${percentage}%)`);
      });
    
    // Quality assessment
    const qualityScore = Math.max(0, 100 - (nullScores.length * 2) - (maxConsecutive > 5 ? 20 : 0));
    
    console.log('\n🎯 Quality Assessment:');
    console.log(`   Quality Score: ${qualityScore}/100`);
    
    if (qualityScore >= 90) {
      console.log('   ✅ Excellent data quality');
    } else if (qualityScore >= 70) {
      console.log('   ⚠️  Good data quality with minor issues');
    } else if (qualityScore >= 50) {
      console.log('   ⚠️  Fair data quality with several issues');
    } else {
      console.log('   ❌ Poor data quality - needs attention');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (nullScores.length > records.length * 0.1) {
      console.log('   - High null score rate - investigate factor computation failures');
    }
    
    if (maxConsecutive > 5) {
      console.log('   - Too many consecutive identical scores - review factor calculations');
    }
    
    if (validScores.length > 0) {
      const uniqueScores = new Set(validScores.map(r => r.score)).size;
      if (uniqueScores < validScores.length * 0.2) {
        console.log('   - Low score diversity - consider backfilling with more varied data');
      }
    }
    
    if (qualityScore >= 90) {
      console.log('   - Data quality is excellent - no immediate action needed');
    }
    
    console.log('\n✅ G-Score history analysis complete!');
    
    return {
      totalRecords: records.length,
      validScores: validScores.length,
      nullScores: nullScores.length,
      qualityScore,
      dateRange: records.length > 0 ? {
        start: records[0].date,
        end: records[records.length - 1].date
      } : null
    };
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}

// Run the analysis
analyzeGScoreHistory().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
