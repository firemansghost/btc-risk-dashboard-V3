#!/usr/bin/env node
/**
 * Factor Dynamics Investigation Script
 * 
 * This script analyzes individual factor data to understand why G-Scores are static.
 * It examines each factor's historical data for patterns, changes, and dynamics.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Load and analyze factor-specific CSV files
 */
async function analyzeFactorCSV(filePath, factorName) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      return { error: 'No data found' };
    }
    
    const header = lines[0].split(',');
    const dataLines = lines.slice(1);
    
    // Parse data
    const records = dataLines.map(line => {
      const values = line.split(',');
      const record = {};
      header.forEach((col, i) => {
        record[col.trim()] = values[i]?.trim() || '';
      });
      return record;
    });
    
    // Analyze dynamics
    const analysis = {
      totalRecords: records.length,
      dateRange: records.length > 0 ? {
        start: records[0].date,
        end: records[records.length - 1].date
      } : null
    };
    
    // Check each numeric column for dynamics
    const numericColumns = header.filter(col => {
      const sampleValue = records[0]?.[col];
      return sampleValue && !isNaN(parseFloat(sampleValue));
    });
    
    analysis.columns = {};
    
    for (const col of numericColumns) {
      const values = records.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const unique = new Set(values).size;
        const range = max - min;
        
        // Check for static values
        const isStatic = unique <= 3 || range < 0.01;
        const isLowDiversity = unique < values.length * 0.1;
        
        analysis.columns[col] = {
          min,
          max,
          avg: avg.toFixed(2),
          unique,
          range: range.toFixed(2),
          isStatic,
          isLowDiversity,
          dynamics: isStatic ? 'STATIC' : isLowDiversity ? 'LOW_DIVERSITY' : 'DYNAMIC'
        };
      }
    }
    
    return analysis;
    
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Analyze all factor files
 */
async function investigateFactorDynamics() {
  console.log('🔍 Investigating Factor Dynamics');
  console.log('================================');
  
  const signalsDir = 'public/signals';
  const factorFiles = [
    'stablecoins_30d.csv',
    'etf_flows_21d.csv', 
    'net_liquidity_20d.csv',
    'mayer_multiple.csv',
    'funding_7d.csv',
    'dxy_20d.csv',
    'fear_greed.csv'
  ];
  
  const results = {};
  
  for (const fileName of factorFiles) {
    const filePath = path.join(signalsDir, fileName);
    const factorName = fileName.replace('.csv', '');
    
    console.log(`\n📊 Analyzing ${factorName}...`);
    
    try {
      const analysis = await analyzeFactorCSV(filePath, factorName);
      
      if (analysis.error) {
        console.log(`   ❌ ${analysis.error}`);
        results[factorName] = { error: analysis.error };
        continue;
      }
      
      console.log(`   📅 Date range: ${analysis.dateRange?.start} to ${analysis.dateRange?.end}`);
      console.log(`   📊 Records: ${analysis.totalRecords}`);
      
      // Show column dynamics
      for (const [colName, colData] of Object.entries(analysis.columns)) {
        const status = colData.dynamics === 'STATIC' ? '🔴' : 
                      colData.dynamics === 'LOW_DIVERSITY' ? '🟡' : '🟢';
        
        console.log(`   ${status} ${colName}:`);
        console.log(`      Range: ${colData.min} to ${colData.max} (${colData.range})`);
        console.log(`      Unique: ${colData.unique}/${analysis.totalRecords} (${(colData.unique/analysis.totalRecords*100).toFixed(1)}%)`);
        console.log(`      Avg: ${colData.avg}`);
        
        if (colData.isStatic) {
          console.log(`      ⚠️  STATIC - No variation detected`);
        } else if (colData.isLowDiversity) {
          console.log(`      ⚠️  LOW DIVERSITY - Limited variation`);
        }
      }
      
      results[factorName] = analysis;
      
    } catch (error) {
      console.log(`   ❌ Error analyzing ${factorName}: ${error.message}`);
      results[factorName] = { error: error.message };
    }
  }
  
  // Summary analysis
  console.log('\n📋 Factor Dynamics Summary');
  console.log('===========================');
  
  const staticFactors = [];
  const lowDiversityFactors = [];
  const dynamicFactors = [];
  
  for (const [factorName, analysis] of Object.entries(results)) {
    if (analysis.error) continue;
    
    let hasStaticColumns = false;
    let hasLowDiversityColumns = false;
    let hasDynamicColumns = false;
    
    for (const colData of Object.values(analysis.columns)) {
      if (colData.isStatic) hasStaticColumns = true;
      else if (colData.isLowDiversity) hasLowDiversityColumns = true;
      else hasDynamicColumns = true;
    }
    
    if (hasStaticColumns) staticFactors.push(factorName);
    if (hasLowDiversityColumns) lowDiversityFactors.push(factorName);
    if (hasDynamicColumns) dynamicFactors.push(factorName);
  }
  
  console.log(`🔴 Static factors (no variation): ${staticFactors.length}`);
  if (staticFactors.length > 0) {
    staticFactors.forEach(factor => console.log(`   - ${factor}`));
  }
  
  console.log(`🟡 Low diversity factors: ${lowDiversityFactors.length}`);
  if (lowDiversityFactors.length > 0) {
    lowDiversityFactors.forEach(factor => console.log(`   - ${factor}`));
  }
  
  console.log(`🟢 Dynamic factors: ${dynamicFactors.length}`);
  if (dynamicFactors.length > 0) {
    dynamicFactors.forEach(factor => console.log(`   - ${factor}`));
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (staticFactors.length > 0) {
    console.log('   🔴 Static factors need investigation:');
    staticFactors.forEach(factor => {
      console.log(`      - ${factor}: Check if data source is updating or if calculation is correct`);
    });
  }
  
  if (lowDiversityFactors.length > 0) {
    console.log('   🟡 Low diversity factors may need adjustment:');
    lowDiversityFactors.forEach(factor => {
      console.log(`      - ${factor}: Consider if scoring range is too narrow or data is too stable`);
    });
  }
  
  if (dynamicFactors.length > 0) {
    console.log('   🟢 Dynamic factors are working well:');
    dynamicFactors.forEach(factor => {
      console.log(`      - ${factor}: Good variation and responsiveness`);
    });
  }
  
  // Overall assessment
  const totalFactors = Object.keys(results).length;
  const problematicFactors = staticFactors.length + lowDiversityFactors.length;
  const healthScore = Math.max(0, 100 - (problematicFactors / totalFactors * 100));
  
  console.log(`\n🎯 Factor Health Score: ${healthScore.toFixed(1)}/100`);
  
  if (healthScore >= 80) {
    console.log('   ✅ Factor dynamics are healthy');
  } else if (healthScore >= 60) {
    console.log('   ⚠️  Some factors need attention');
  } else {
    console.log('   ❌ Multiple factors have issues - comprehensive review needed');
  }
  
  return results;
}

// Run the investigation
investigateFactorDynamics().catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});
