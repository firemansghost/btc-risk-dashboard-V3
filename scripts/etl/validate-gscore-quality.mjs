#!/usr/bin/env node
/**
 * G-Score Data Quality Validation Script
 * 
 * This script validates the quality of G-Score historical data and
 * identifies potential issues that need attention.
 * 
 * Features:
 * - Detects suspicious patterns (too many identical scores)
 * - Validates score ranges and distributions
 * - Checks for data gaps and anomalies
 * - Provides detailed quality reports
 * - Suggests fixes for common issues
 */

import fs from 'fs/promises';

/**
 * Load and parse G-Score history
 */
async function loadGScoreHistory() {
  try {
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      return { records: [], issues: ['No data found in history.csv'] };
    }
    
    const records = [];
    const issues = [];
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const parts = lines[i].split(',');
      
      if (parts.length < 4) {
        issues.push(`Invalid line ${i + 1}: insufficient columns`);
        continue;
      }
      
      const [date, scoreStr, band, priceStr] = parts;
      const score = scoreStr === 'null' || scoreStr === '' ? null : parseFloat(scoreStr);
      const price = parseFloat(priceStr);
      
      if (isNaN(price)) {
        issues.push(`Invalid price on line ${i + 1}: ${priceStr}`);
        continue;
      }
      
      records.push({
        date,
        score,
        band,
        price,
        lineNumber: i + 1
      });
    }
    
    return { records, issues };
  } catch (error) {
    return { records: [], issues: [`Failed to load history.csv: ${error.message}`] };
  }
}

/**
 * Validate date continuity
 */
function validateDateContinuity(records) {
  const issues = [];
  
  if (records.length < 2) return issues;
  
  // Sort by date
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  
  for (let i = 1; i < sortedRecords.length; i++) {
    const prevDate = new Date(sortedRecords[i - 1].date);
    const currDate = new Date(sortedRecords[i].date);
    const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) {
      issues.push(`Large gap between ${sortedRecords[i - 1].date} and ${sortedRecords[i].date} (${Math.round(daysDiff)} days)`);
    }
    
    if (daysDiff < 0) {
      issues.push(`Date order issue: ${sortedRecords[i - 1].date} after ${sortedRecords[i].date}`);
    }
  }
  
  return issues;
}

/**
 * Validate score patterns and detect anomalies
 */
function validateScorePatterns(records) {
  const issues = [];
  const validScores = records.filter(r => r.score !== null).map(r => r.score);
  
  if (validScores.length === 0) {
    issues.push('No valid scores found');
    return issues;
  }
  
  // Check for too many consecutive identical scores
  let consecutiveIdentical = 0;
  let maxConsecutive = 0;
  let lastScore = null;
  let consecutiveStart = null;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    if (record.score === lastScore && record.score !== null) {
      consecutiveIdentical++;
      if (consecutiveStart === null) consecutiveStart = i - consecutiveIdentical;
      maxConsecutive = Math.max(maxConsecutive, consecutiveIdentical);
    } else {
      if (consecutiveIdentical > 5) {
        const startRecord = records[consecutiveStart];
        const endRecord = records[consecutiveStart + consecutiveIdentical];
        issues.push(`Consecutive identical scores: ${consecutiveIdentical} days from ${startRecord.date} to ${endRecord.date} (score: ${lastScore})`);
      }
      consecutiveIdentical = 0;
      consecutiveStart = null;
    }
    lastScore = record.score;
  }
  
  // Check final consecutive run
  if (consecutiveIdentical > 5) {
    const startRecord = records[consecutiveStart];
    const endRecord = records[records.length - 1];
    issues.push(`Consecutive identical scores: ${consecutiveIdentical} days from ${startRecord.date} to ${endRecord.date} (score: ${lastScore})`);
  }
  
  // Check score distribution
  const uniqueScores = new Set(validScores);
  const scoreVariation = Math.max(...validScores) - Math.min(...validScores);
  
  if (uniqueScores.size < validScores.length * 0.1) {
    issues.push(`Low score diversity: only ${uniqueScores.size} unique scores out of ${validScores.length} (${(uniqueScores.size/validScores.length*100).toFixed(1)}%)`);
  }
  
  if (scoreVariation < 10) {
    issues.push(`Very low score range: ${scoreVariation.toFixed(1)} points (scores: ${Math.min(...validScores).toFixed(1)}-${Math.max(...validScores).toFixed(1)})`);
  }
  
  // Check for unrealistic scores
  const invalidScores = validScores.filter(score => score < 0 || score > 100);
  if (invalidScores.length > 0) {
    issues.push(`Invalid score range: ${invalidScores.length} scores outside 0-100 range`);
  }
  
  return issues;
}

/**
 * Validate band assignments
 */
function validateBandAssignments(records) {
  const issues = [];
  
  for (const record of records) {
    if (record.score === null) continue;
    
    const expectedBand = getExpectedBand(record.score);
    if (record.band !== expectedBand) {
      issues.push(`Band mismatch for ${record.date}: score ${record.score} should be "${expectedBand}" but is "${record.band}"`);
    }
  }
  
  return issues;
}

/**
 * Get expected band for a score
 */
function getExpectedBand(score) {
  if (score < 15) return "Aggressive Buying";
  if (score < 35) return "Regular DCA Buying";
  if (score < 50) return "Moderate Buying";
  if (score < 65) return "Hold & Wait";
  if (score < 80) return "Reduce Risk";
  return "High Risk";
}

/**
 * Validate price data consistency
 */
function validatePriceData(records) {
  const issues = [];
  
  for (const record of records) {
    if (record.price <= 0) {
      issues.push(`Invalid price for ${record.date}: ${record.price}`);
    }
    
    if (record.price < 1000 || record.price > 200000) {
      issues.push(`Suspicious price for ${record.date}: $${record.price.toFixed(2)} (outside expected range)`);
    }
  }
  
  // Check for price jumps
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sortedRecords.length; i++) {
    const prevPrice = sortedRecords[i - 1].price;
    const currPrice = sortedRecords[i].price;
    const changePercent = Math.abs(currPrice - prevPrice) / prevPrice * 100;
    
    if (changePercent > 50) {
      issues.push(`Large price jump between ${sortedRecords[i - 1].date} and ${sortedRecords[i].date}: ${changePercent.toFixed(1)}% change`);
    }
  }
  
  return issues;
}

/**
 * Generate quality report
 */
function generateQualityReport(records, allIssues) {
  const validScores = records.filter(r => r.score !== null);
  const nullScores = records.filter(r => r.score === null);
  
  const report = {
    summary: {
      totalRecords: records.length,
      validScores: validScores.length,
      nullScores: nullScores.length,
      dateRange: records.length > 0 ? {
        start: records[0].date,
        end: records[records.length - 1].date
      } : null
    },
    scoreStats: validScores.length > 0 ? {
      min: Math.min(...validScores.map(r => r.score)),
      max: Math.max(...validScores.map(r => r.score)),
      avg: validScores.reduce((sum, r) => sum + r.score, 0) / validScores.length,
      unique: new Set(validScores.map(r => r.score)).size
    } : null,
    issues: {
      total: allIssues.length,
      byCategory: {
        dateContinuity: allIssues.filter(i => i.includes('gap') || i.includes('order')).length,
        scorePatterns: allIssues.filter(i => i.includes('identical') || i.includes('diversity') || i.includes('range')).length,
        bandMismatches: allIssues.filter(i => i.includes('Band mismatch')).length,
        priceIssues: allIssues.filter(i => i.includes('price') || i.includes('jump')).length
      }
    },
    recommendations: []
  };
  
  // Generate recommendations
  if (report.issues.byCategory.scorePatterns > 0) {
    report.recommendations.push('Review factor calculations for periods with identical scores');
  }
  
  if (report.issues.byCategory.bandMismatches > 0) {
    report.recommendations.push('Fix band assignment logic or recalculate scores');
  }
  
  if (report.issues.byCategory.dateContinuity > 0) {
    report.recommendations.push('Fill in missing dates or investigate data gaps');
  }
  
  if (nullScores.length > records.length * 0.1) {
    report.recommendations.push('Investigate high null score rate - check factor computation failures');
  }
  
  if (report.scoreStats && report.scoreStats.unique < validScores.length * 0.2) {
    report.recommendations.push('Consider backfilling with more diverse historical data');
  }
  
  return report;
}

/**
 * Main validation function
 */
async function validateGScoreQuality() {
  console.log('🔍 G-Score Data Quality Validation');
  console.log('==================================');
  
  // Load data
  console.log('📊 Loading G-Score history...');
  const { records, issues: loadIssues } = await loadGScoreHistory();
  
  if (loadIssues.length > 0) {
    console.log('❌ Data loading issues:');
    loadIssues.forEach(issue => console.log(`   - ${issue}`));
    return;
  }
  
  if (records.length === 0) {
    console.log('❌ No data found to validate');
    return;
  }
  
  console.log(`📊 Loaded ${records.length} records`);
  
  // Run validations
  console.log('\n🔍 Running quality checks...');
  
  const allIssues = [
    ...loadIssues,
    ...validateDateContinuity(records),
    ...validateScorePatterns(records),
    ...validateBandAssignments(records),
    ...validatePriceData(records)
  ];
  
  // Generate report
  const report = generateQualityReport(records, allIssues);
  
  // Display results
  console.log('\n📋 Quality Report');
  console.log('================');
  console.log(`📊 Total records: ${report.summary.totalRecords}`);
  console.log(`✅ Valid scores: ${report.summary.validScores}`);
  console.log(`❌ Null scores: ${report.summary.nullScores}`);
  
  if (report.summary.dateRange) {
    console.log(`📅 Date range: ${report.summary.dateRange.start} to ${report.summary.dateRange.end}`);
  }
  
  if (report.scoreStats) {
    console.log('\n📊 Score Statistics:');
    console.log(`   Min: ${report.scoreStats.min.toFixed(1)}`);
    console.log(`   Max: ${report.scoreStats.max.toFixed(1)}`);
    console.log(`   Avg: ${report.scoreStats.avg.toFixed(1)}`);
    console.log(`   Unique: ${report.scoreStats.unique}`);
  }
  
  console.log(`\n⚠️  Issues found: ${report.issues.total}`);
  console.log(`   📅 Date continuity: ${report.issues.byCategory.dateContinuity}`);
  console.log(`   📊 Score patterns: ${report.issues.byCategory.scorePatterns}`);
  console.log(`   🏷️  Band mismatches: ${report.issues.byCategory.bandMismatches}`);
  console.log(`   💰 Price issues: ${report.issues.byCategory.priceIssues}`);
  
  if (allIssues.length > 0) {
    console.log('\n❌ Detailed Issues:');
    allIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }
  
  // Overall assessment
  const qualityScore = Math.max(0, 100 - (report.issues.total * 10));
  console.log(`\n🎯 Overall Quality Score: ${qualityScore}/100`);
  
  if (qualityScore >= 90) {
    console.log('✅ Excellent data quality');
  } else if (qualityScore >= 70) {
    console.log('⚠️  Good data quality with minor issues');
  } else if (qualityScore >= 50) {
    console.log('⚠️  Fair data quality with several issues');
  } else {
    console.log('❌ Poor data quality - significant issues need attention');
  }
  
  return report;
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateGScoreQuality().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export { validateGScoreQuality };
