#!/usr/bin/env node
/**
 * Factor Performance Attribution Analysis
 * 
 * This script analyzes which factors drive G-Score changes and provides
 * attribution analysis for understanding factor contributions.
 */

import fs from 'node:fs';

/**
 * Calculate factor contribution to G-Score changes
 */
function calculateFactorAttribution(factorHistory) {
  if (factorHistory.length < 2) {
    return {
      success: false,
      message: 'Insufficient data for attribution analysis'
    };
  }
  
  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];
  
  // Factor weights (from dashboard config)
  const weights = {
    trend_valuation: 0.20,
    onchain: 0.05,
    stablecoins: 0.21,
    etf_flows: 0.09,
    net_liquidity: 0.05,
    term_leverage: 0.20,
    macro_overlay: 0.10,
    social_interest: 0.10
  };
  
  // Calculate daily changes
  const dailyChanges = [];
  for (let i = 1; i < factorHistory.length; i++) {
    const current = factorHistory[i];
    const previous = factorHistory[i - 1];
    
    const changes = {
      date: current.date,
      composite_change: current.composite_score - previous.composite_score,
      factor_changes: {}
    };
    
    for (const factorKey of factorKeys) {
      const scoreKey = `${factorKey}_score`;
      const currentScore = current[scoreKey];
      const previousScore = previous[scoreKey];
      
      if (currentScore !== null && previousScore !== null && 
          !isNaN(currentScore) && !isNaN(previousScore)) {
        changes.factor_changes[factorKey] = currentScore - previousScore;
      } else {
        changes.factor_changes[factorKey] = null;
      }
    }
    
    dailyChanges.push(changes);
  }
  
  // Calculate attribution for each day
  const attributionAnalysis = [];
  for (const change of dailyChanges) {
    const attribution = {
      date: change.date,
      composite_change: change.composite_change,
      factor_contributions: {},
      top_contributors: [],
      attribution_quality: 0
    };
    
    let totalAttribution = 0;
    const contributions = [];
    
    for (const factorKey of factorKeys) {
      const factorChange = change.factor_changes[factorKey];
      if (factorChange !== null) {
        const contribution = factorChange * weights[factorKey];
        attribution.factor_contributions[factorKey] = {
          change: factorChange,
          weight: weights[factorKey],
          contribution: contribution,
          contribution_pct: 0 // Will be calculated after total
        };
        contributions.push({
          factor: factorKey,
          contribution: contribution,
          abs_contribution: Math.abs(contribution)
        });
        totalAttribution += contribution;
      }
    }
    
    // Calculate percentage contributions
    for (const factorKey of factorKeys) {
      if (attribution.factor_contributions[factorKey]) {
        const contribution = attribution.factor_contributions[factorKey].contribution;
        attribution.factor_contributions[factorKey].contribution_pct = 
          totalAttribution !== 0 ? (contribution / totalAttribution) * 100 : 0;
      }
    }
    
    // Sort by absolute contribution
    contributions.sort((a, b) => b.abs_contribution - a.abs_contribution);
    attribution.top_contributors = contributions.slice(0, 3);
    
    // Calculate attribution quality (how well factors explain the change)
    attribution.attribution_quality = totalAttribution !== 0 
      ? Math.min(100, Math.max(0, 100 - Math.abs(change.composite_change - totalAttribution) / Math.abs(change.composite_change) * 100))
      : 0;
    
    attributionAnalysis.push(attribution);
  }
  
  return {
    success: true,
    dailyChanges: dailyChanges,
    attributionAnalysis: attributionAnalysis,
    totalDays: attributionAnalysis.length
  };
}

/**
 * Calculate factor performance statistics
 */
function calculateFactorPerformanceStats(attributionAnalysis) {
  const factorKeys = [
    'trend_valuation', 'onchain', 'stablecoins', 'etf_flows',
    'net_liquidity', 'term_leverage', 'macro_overlay', 'social_interest'
  ];
  
  const factorStats = {};
  
  for (const factorKey of factorKeys) {
    const contributions = attributionAnalysis
      .map(day => day.factor_contributions[factorKey])
      .filter(contrib => contrib && contrib.contribution !== null);
    
    if (contributions.length > 0) {
      const totalContribution = contributions.reduce((sum, contrib) => sum + contrib.contribution, 0);
      const avgContribution = totalContribution / contributions.length;
      const absContributions = contributions.map(contrib => Math.abs(contrib.contribution));
      const avgAbsContribution = absContributions.reduce((sum, contrib) => sum + contrib, 0) / absContributions.length;
      
      // Count positive and negative contributions
      const positiveContributions = contributions.filter(contrib => contrib.contribution > 0).length;
      const negativeContributions = contributions.filter(contrib => contrib.contribution < 0).length;
      
      factorStats[factorKey] = {
        totalContribution: Math.round(totalContribution * 100) / 100,
        avgContribution: Math.round(avgContribution * 100) / 100,
        avgAbsContribution: Math.round(avgAbsContribution * 100) / 100,
        positiveDays: positiveContributions,
        negativeDays: negativeContributions,
        contributionFrequency: Math.round((contributions.length / attributionAnalysis.length) * 100),
        impactScore: Math.round(avgAbsContribution * 100) / 100
      };
    } else {
      factorStats[factorKey] = {
        totalContribution: 0,
        avgContribution: 0,
        avgAbsContribution: 0,
        positiveDays: 0,
        negativeDays: 0,
        contributionFrequency: 0,
        impactScore: 0
      };
    }
  }
  
  return factorStats;
}

/**
 * Generate factor performance attribution analysis
 */
async function generateFactorPerformanceAttribution() {
  console.log('📊 Generating Factor Performance Attribution Analysis');
  console.log('===================================================');
  
  try {
    // Load factor history
    const historyPath = 'public/data/factor_history.csv';
    if (!fs.existsSync(historyPath)) {
      console.log('❌ Factor history not found');
      return { success: false, error: 'Factor history not found' };
    }
    
    const content = fs.readFileSync(historyPath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      console.log('❌ No factor history data available');
      return { success: false, error: 'No factor history data' };
    }
    
    // Parse factor history
    const factorHistory = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 19) {
        factorHistory.push({
          date: parts[0],
          trend_valuation_score: parts[1] === 'null' ? null : parseFloat(parts[1]),
          onchain_score: parts[3] === 'null' ? null : parseFloat(parts[3]),
          stablecoins_score: parts[5] === 'null' ? null : parseFloat(parts[5]),
          etf_flows_score: parts[7] === 'null' ? null : parseFloat(parts[7]),
          net_liquidity_score: parts[9] === 'null' ? null : parseFloat(parts[9]),
          term_leverage_score: parts[11] === 'null' ? null : parseFloat(parts[11]),
          macro_overlay_score: parts[13] === 'null' ? null : parseFloat(parts[13]),
          social_interest_score: parts[15] === 'null' ? null : parseFloat(parts[15]),
          composite_score: parseFloat(parts[17])
        });
      }
    }
    
    console.log(`✅ Loaded ${factorHistory.length} factor history records`);
    
    // Calculate attribution analysis
    const attributionResult = calculateFactorAttribution(factorHistory);
    
    if (!attributionResult.success) {
      console.log(`❌ ${attributionResult.message}`);
      return { success: false, error: attributionResult.message };
    }
    
    // Calculate factor performance statistics
    const factorStats = calculateFactorPerformanceStats(attributionResult.attributionAnalysis);
    
    // Create comprehensive analysis
    const performanceAttribution = {
      timestamp: new Date().toISOString(),
      dataPoints: factorHistory.length,
      attributionDays: attributionResult.totalDays,
      dailyAttribution: attributionResult.attributionAnalysis,
      factorStats: factorStats,
      summary: {
        avgAttributionQuality: Math.round(
          attributionResult.attributionAnalysis.reduce((sum, day) => sum + day.attribution_quality, 0) / 
          attributionResult.attributionAnalysis.length * 100
        ) / 100,
        topPerformingFactors: Object.entries(factorStats)
          .sort(([,a], [,b]) => b.impactScore - a.impactScore)
          .slice(0, 3)
          .map(([factor, stats]) => ({ factor, impactScore: stats.impactScore }))
      }
    };
    
    // Save performance attribution analysis
    const analysisPath = 'public/data/factor_performance_attribution.json';
    fs.writeFileSync(analysisPath, JSON.stringify(performanceAttribution, null, 2), 'utf8');
    
    // Display summary
    console.log('\n📋 Factor Performance Attribution Summary');
    console.log('========================================');
    console.log(`Data Points: ${performanceAttribution.dataPoints}`);
    console.log(`Attribution Days: ${performanceAttribution.attributionDays}`);
    console.log(`Avg Attribution Quality: ${performanceAttribution.summary.avgAttributionQuality}%`);
    
    console.log('\n🏆 Top Performing Factors (by Impact Score):');
    performanceAttribution.summary.topPerformingFactors.forEach(({ factor, impactScore }, index) => {
      console.log(`   ${index + 1}. ${factor}: ${impactScore}`);
    });
    
    console.log('\n📊 Factor Performance Statistics:');
    for (const [factorKey, stats] of Object.entries(factorStats)) {
      console.log(`\n   ${factorKey}:`);
      console.log(`     Total Contribution: ${stats.totalContribution}`);
      console.log(`     Avg Contribution: ${stats.avgContribution}`);
      console.log(`     Impact Score: ${stats.impactScore}`);
      console.log(`     Positive Days: ${stats.positiveDays}, Negative Days: ${stats.negativeDays}`);
      console.log(`     Contribution Frequency: ${stats.contributionFrequency}%`);
    }
    
    console.log(`\n📄 Performance attribution analysis saved to: ${analysisPath}`);
    
    return {
      success: true,
      attributionAnalysis: attributionResult.attributionAnalysis,
      factorStats: factorStats,
      summary: performanceAttribution.summary
    };
    
  } catch (error) {
    console.error('❌ Performance attribution analysis generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the function for use in other modules
export { generateFactorPerformanceAttribution };

// Run the performance attribution analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFactorPerformanceAttribution().catch(error => {
    console.error('❌ Performance attribution analysis generation failed:', error);
    process.exit(1);
  });
}
