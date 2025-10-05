#!/usr/bin/env node

// Bundle Analysis Utility
// Analyzes bundle composition and identifies optimization opportunities

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ANALYSIS_DIR = './bundle-analysis';
const REPORTS_DIR = path.join(ANALYSIS_DIR, 'reports');

// Ensure analysis directories exist
if (!fs.existsSync(ANALYSIS_DIR)) {
  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🔍 Bundle Analysis Utility');
console.log('========================\n');

// Function to run bundle analysis
async function runBundleAnalysis() {
  console.log('📊 Running bundle analysis...\n');
  
  try {
    // Run the bundle analyzer
    console.log('Building with bundle analyzer...');
    execSync('npm run analyze', { stdio: 'inherit' });
    
    console.log('✅ Bundle analysis completed!');
    console.log('📁 Reports generated in .next/analyze/');
    
    // Generate analysis summary
    generateAnalysisSummary();
    
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

// Function to analyze package.json dependencies
function analyzeDependencies() {
  console.log('📦 Analyzing dependencies...\n');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  console.log('📊 Dependency Analysis:');
  console.log('======================');
  console.log(`Total dependencies: ${Object.keys(dependencies).length}`);
  console.log(`Production dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
  console.log(`Development dependencies: ${Object.keys(packageJson.devDependencies || {}).length}\n`);
  
  // Identify potentially heavy dependencies
  const heavyDependencies = [
    'react', 'next', 'typescript', 'tailwindcss', 'recharts',
    'date-fns', 'lodash', 'moment', 'axios', 'express'
  ];
  
  const foundHeavy = Object.keys(dependencies).filter(dep => 
    heavyDependencies.some(heavy => dep.includes(heavy))
  );
  
  console.log('🔍 Potentially Heavy Dependencies:');
  foundHeavy.forEach(dep => {
    console.log(`  - ${dep}@${dependencies[dep]}`);
  });
  
  return {
    total: Object.keys(dependencies).length,
    production: Object.keys(packageJson.dependencies || {}).length,
    development: Object.keys(packageJson.devDependencies || {}).length,
    heavy: foundHeavy
  };
}

// Function to check for unused dependencies
function checkUnusedDependencies() {
  console.log('\n🔍 Checking for unused dependencies...\n');
  
  try {
    // This would require installing depcheck
    // For now, we'll provide manual guidance
    console.log('💡 To check for unused dependencies, run:');
    console.log('   npx depcheck');
    console.log('   or');
    console.log('   npm install -g depcheck && depcheck\n');
    
    console.log('📋 Manual dependency review:');
    console.log('1. Check imports in your codebase');
    console.log('2. Look for dependencies not used in any file');
    console.log('3. Consider removing unused packages\n');
    
  } catch (error) {
    console.log('⚠️  Could not run dependency check automatically');
    console.log('   Please run "npx depcheck" manually\n');
  }
}

// Function to generate analysis summary
function generateAnalysisSummary() {
  const timestamp = new Date().toISOString();
  const summary = {
    timestamp,
    analysis: {
      bundleAnalyzer: 'Completed - Check .next/analyze/ for visual reports',
      dependencies: analyzeDependencies(),
      recommendations: [
        'Review bundle analyzer reports in .next/analyze/',
        'Check for unused dependencies with "npx depcheck"',
        'Consider code splitting for large components',
        'Optimize imports to reduce bundle size',
        'Replace heavy dependencies with lighter alternatives'
      ]
    }
  };
  
  const summaryPath = path.join(REPORTS_DIR, `analysis-summary-${Date.now()}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log(`📄 Analysis summary saved to: ${summaryPath}`);
}

// Function to provide optimization recommendations
function provideRecommendations() {
  console.log('\n💡 Optimization Recommendations:');
  console.log('================================');
  console.log('1. 📊 Review bundle analyzer reports in .next/analyze/');
  console.log('2. 🗑️  Remove unused dependencies');
  console.log('3. 🔄 Replace heavy dependencies with lighter alternatives');
  console.log('4. 📦 Implement better code splitting');
  console.log('5. 🌳 Optimize tree-shaking');
  console.log('6. 🚀 Use dynamic imports for heavy components');
  console.log('7. 📱 Optimize for mobile bundle size');
  console.log('8. 🎯 Focus on Core Web Vitals');
}

// Main execution
async function main() {
  console.log('Starting bundle analysis...\n');
  
  // Run bundle analysis
  await runBundleAnalysis();
  
  // Analyze dependencies
  analyzeDependencies();
  
  // Check for unused dependencies
  checkUnusedDependencies();
  
  // Provide recommendations
  provideRecommendations();
  
  console.log('\n✅ Phase 1: Analysis Setup Complete!');
  console.log('📊 Check .next/analyze/ for detailed bundle reports');
  console.log('📁 Analysis summary saved to bundle-analysis/reports/');
}

// Run the analysis
main().catch(console.error);

