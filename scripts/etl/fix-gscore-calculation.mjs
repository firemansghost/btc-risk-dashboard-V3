#!/usr/bin/env node
/**
 * Fix G-Score Calculation
 * 
 * This script fixes the G-Score calculation by properly handling
 * weight renormalization when factors are excluded.
 */

import fs from 'node:fs';

/**
 * Fix G-Score calculation with proper weight renormalization
 */
function fixGScoreCalculation() {
  console.log('🔧 Fixing G-Score Calculation');
  console.log('=============================');
  
  try {
    // Load latest data
    const latestPath = 'public/data/latest.json';
    const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    
    console.log('✅ Loaded latest data');
    console.log(`Current G-Score: ${data.composite_score}`);
    
    // Get active factors (those with valid scores)
    const activeFactors = data.factors.filter(f => f.score !== null && f.score !== undefined);
    const excludedFactors = data.factors.filter(f => f.score === null || f.score === undefined);
    
    console.log(`\nActive factors: ${activeFactors.length}`);
    console.log(`Excluded factors: ${excludedFactors.length}`);
    
    if (excludedFactors.length > 0) {
      console.log('\nExcluded factors:');
      excludedFactors.forEach(f => {
        console.log(`  - ${f.label}: ${f.reason}`);
      });
    }
    
    // Calculate total weight of active factors
    const totalActiveWeight = activeFactors.reduce((sum, f) => sum + f.weight, 0);
    console.log(`\nTotal active weight: ${totalActiveWeight}%`);
    
    if (totalActiveWeight < 100) {
      console.log(`Missing weight: ${100 - totalActiveWeight}%`);
      
      // Calculate corrected G-Score with renormalized weights
      let correctedScore = 0;
      let totalWeight = 0;
      
      activeFactors.forEach(factor => {
        const renormalizedWeight = (factor.weight / totalActiveWeight) * 100;
        correctedScore += (factor.score * renormalizedWeight) / 100;
        totalWeight += renormalizedWeight;
        
        console.log(`  ${factor.label}: ${factor.score} × ${renormalizedWeight.toFixed(1)}% = ${(factor.score * renormalizedWeight / 100).toFixed(1)}`);
      });
      
      console.log(`\nCorrected G-Score: ${Math.round(correctedScore)}`);
      console.log(`Total weight: ${totalWeight.toFixed(1)}%`);
      
      // Determine the correct risk band
      let correctedBand = 'Unknown';
      if (correctedScore >= 80) correctedBand = 'Increase Selling';
      else if (correctedScore >= 60) correctedBand = 'Begin Scaling Out';
      else if (correctedScore >= 40) correctedBand = 'Hold/Neutral';
      else if (correctedScore >= 20) correctedBand = 'Begin Scaling In';
      else correctedBand = 'Increase Buying';
      
      console.log(`Corrected Band: ${correctedBand}`);
      
      // Update the data with corrected values
      data.composite_score = Math.round(correctedScore);
      data.composite_raw = Math.round(correctedScore);
      
      // Update the band information
      data.band = {
        key: correctedBand.toLowerCase().replace(/\s+/g, '_'),
        label: correctedBand,
        range: getBandRange(correctedScore),
        color: getBandColor(correctedScore),
        recommendation: correctedBand
      };
      
      // Save corrected data
      fs.writeFileSync(latestPath, JSON.stringify(data, null, 2), 'utf8');
      
      console.log(`\n✅ Updated latest.json with corrected G-Score: ${Math.round(correctedScore)}`);
      
      return {
        success: true,
        originalScore: data.composite_score,
        correctedScore: Math.round(correctedScore),
        excludedFactors: excludedFactors.length,
        missingWeight: 100 - totalActiveWeight
      };
    } else {
      console.log('✅ All factors active, no renormalization needed');
      return {
        success: true,
        message: 'No weight renormalization needed'
      };
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get band range for a given score
 */
function getBandRange(score) {
  if (score >= 80) return [70, 85];
  if (score >= 60) return [60, 79];
  if (score >= 40) return [40, 59];
  if (score >= 20) return [20, 39];
  return [0, 19];
}

/**
 * Get band color for a given score
 */
function getBandColor(score) {
  if (score >= 80) return '#6B7280'; // Gray
  if (score >= 60) return '#F59E0B'; // Amber
  if (score >= 40) return '#10B981'; // Green
  if (score >= 20) return '#3B82F6'; // Blue
  return '#8B5CF6'; // Purple
}

// Run the fix if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixGScoreCalculation().catch(error => {
    console.error('❌ G-Score fix failed:', error);
    process.exit(1);
  });
}

export { fixGScoreCalculation };
