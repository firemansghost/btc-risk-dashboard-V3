#!/usr/bin/env node

/**
 * CI/CD Bundle Size Tracking Script
 * 
 * This script tracks bundle size changes in CI/CD pipelines
 * and provides regression detection and reporting.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const CONFIG = {
  buildCommand: 'npm run build',
  outputDir: '.next',
  trackingFile: 'bundle-size-tracking.json',
  thresholds: {
    bundleSize: {
      warning: 400000,   // 400KB
      error: 500000,     // 500KB
      critical: 750000,  // 750KB
    },
    gzippedSize: {
      warning: 100000,   // 100KB
      error: 150000,     // 150KB
      critical: 200000,  // 200KB
    },
    chunkSize: {
      warning: 100000,   // 100KB per chunk
      error: 150000,    // 150KB per chunk
      critical: 200000, // 200KB per chunk
    },
  },
  alerts: {
    slack: process.env.SLACK_WEBHOOK_URL,
    email: process.env.EMAIL_ALERTS,
    github: process.env.GITHUB_TOKEN,
  },
};

// Bundle size tracking data structure
const bundleSizeData = {
  timestamp: Date.now(),
  buildId: process.env.BUILD_ID || `build-${Date.now()}`,
  commitHash: process.env.COMMIT_HASH || execSync('git rev-parse HEAD').toString().trim(),
  branch: process.env.BRANCH_NAME || execSync('git branch --show-current').toString().trim(),
  totalSize: 0,
  gzippedSize: 0,
  chunks: {},
  assets: {},
  dependencies: {},
  unusedDependencies: [],
  treeShakingEfficiency: 0,
  compressionRatio: 0,
  alerts: [],
  recommendations: [],
};

// Main execution
async function main() {
  console.log('🔍 Starting bundle size tracking...');
  
  try {
    // 1. Build the application
    console.log('📦 Building application...');
    execSync(CONFIG.buildCommand, { stdio: 'inherit' });
    
    // 2. Analyze bundle size
    console.log('📊 Analyzing bundle size...');
    await analyzeBundleSize();
    
    // 3. Check for regressions
    console.log('🚨 Checking for regressions...');
    await checkRegressions();
    
    // 4. Generate recommendations
    console.log('💡 Generating recommendations...');
    await generateRecommendations();
    
    // 5. Save tracking data
    console.log('💾 Saving tracking data...');
    await saveTrackingData();
    
    // 6. Send alerts if needed
    if (bundleSizeData.alerts.length > 0) {
      console.log('📢 Sending alerts...');
      await sendAlerts();
    }
    
    // 7. Generate report
    console.log('📋 Generating report...');
    await generateReport();
    
    console.log('✅ Bundle size tracking completed successfully!');
    
  } catch (error) {
    console.error('❌ Bundle size tracking failed:', error.message);
    process.exit(1);
  }
}

// Analyze bundle size from build output
async function analyzeBundleSize() {
  const buildOutputPath = path.join(process.cwd(), CONFIG.outputDir);
  
  if (!fs.existsSync(buildOutputPath)) {
    throw new Error(`Build output directory not found: ${buildOutputPath}`);
  }
  
  // Analyze static files
  const staticPath = path.join(buildOutputPath, 'static');
  if (fs.existsSync(staticPath)) {
    const staticFiles = await getDirectorySize(staticPath);
    bundleSizeData.totalSize += staticFiles.totalSize;
    bundleSizeData.assets = { ...bundleSizeData.assets, ...staticFiles.files };
  }
  
  // Analyze chunks
  const chunksPath = path.join(staticPath, 'chunks');
  if (fs.existsSync(chunksPath)) {
    const chunks = await getDirectorySize(chunksPath);
    bundleSizeData.chunks = chunks.files;
    bundleSizeData.totalSize += chunks.totalSize;
  }
  
  // Calculate gzipped size (simplified)
  bundleSizeData.gzippedSize = Math.round(bundleSizeData.totalSize * 0.3);
  
  // Calculate compression ratio
  bundleSizeData.compressionRatio = bundleSizeData.gzippedSize / bundleSizeData.totalSize;
  
  console.log(`📊 Bundle size: ${formatBytes(bundleSizeData.totalSize)}`);
  console.log(`📊 Gzipped size: ${formatBytes(bundleSizeData.gzippedSize)}`);
  console.log(`📊 Compression ratio: ${(bundleSizeData.compressionRatio * 100).toFixed(1)}%`);
}

// Get directory size and file information
async function getDirectorySize(dirPath) {
  const files = {};
  let totalSize = 0;
  
  function scanDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        scanDirectory(itemPath);
      } else {
        const relativePath = path.relative(dirPath, itemPath);
        files[relativePath] = stats.size;
        totalSize += stats.size;
      }
    }
  }
  
  scanDirectory(dirPath);
  
  return { files, totalSize };
}

// Check for bundle size regressions
async function checkRegressions() {
  // Load previous tracking data
  const trackingFile = path.join(process.cwd(), CONFIG.trackingFile);
  let previousData = null;
  
  if (fs.existsSync(trackingFile)) {
    try {
      previousData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
    } catch (error) {
      console.warn('⚠️ Could not load previous tracking data:', error.message);
    }
  }
  
  // Check total size regressions
  if (bundleSizeData.totalSize > CONFIG.thresholds.bundleSize.critical) {
    bundleSizeData.alerts.push({
      type: 'size_increase',
      severity: 'critical',
      message: `Bundle size exceeded critical threshold: ${formatBytes(bundleSizeData.totalSize)}`,
      current: bundleSizeData.totalSize,
      previous: previousData?.totalSize || 0,
      change: bundleSizeData.totalSize - (previousData?.totalSize || 0),
      changePercent: previousData ? 
        ((bundleSizeData.totalSize - previousData.totalSize) / previousData.totalSize) * 100 : 0,
      threshold: CONFIG.thresholds.bundleSize.critical,
      recommendation: 'Critical: Implement aggressive code splitting and remove unused dependencies',
    });
  } else if (bundleSizeData.totalSize > CONFIG.thresholds.bundleSize.error) {
    bundleSizeData.alerts.push({
      type: 'size_increase',
      severity: 'error',
      message: `Bundle size exceeded error threshold: ${formatBytes(bundleSizeData.totalSize)}`,
      current: bundleSizeData.totalSize,
      previous: previousData?.totalSize || 0,
      change: bundleSizeData.totalSize - (previousData?.totalSize || 0),
      changePercent: previousData ? 
        ((bundleSizeData.totalSize - previousData.totalSize) / previousData.totalSize) * 100 : 0,
      threshold: CONFIG.thresholds.bundleSize.error,
      recommendation: 'Error: Review bundle composition and implement optimizations',
    });
  } else if (bundleSizeData.totalSize > CONFIG.thresholds.bundleSize.warning) {
    bundleSizeData.alerts.push({
      type: 'size_increase',
      severity: 'warning',
      message: `Bundle size exceeded warning threshold: ${formatBytes(bundleSizeData.totalSize)}`,
      current: bundleSizeData.totalSize,
      previous: previousData?.totalSize || 0,
      change: bundleSizeData.totalSize - (previousData?.totalSize || 0),
      changePercent: previousData ? 
        ((bundleSizeData.totalSize - previousData.totalSize) / previousData.totalSize) * 100 : 0,
      threshold: CONFIG.thresholds.bundleSize.warning,
      recommendation: 'Warning: Monitor bundle size and consider optimization',
    });
  }
  
  // Check gzipped size regressions
  if (bundleSizeData.gzippedSize > CONFIG.thresholds.gzippedSize.critical) {
    bundleSizeData.alerts.push({
      type: 'gzipped_size_increase',
      severity: 'critical',
      message: `Gzipped size exceeded critical threshold: ${formatBytes(bundleSizeData.gzippedSize)}`,
      current: bundleSizeData.gzippedSize,
      previous: previousData?.gzippedSize || 0,
      change: bundleSizeData.gzippedSize - (previousData?.gzippedSize || 0),
      changePercent: previousData ? 
        ((bundleSizeData.gzippedSize - previousData.gzippedSize) / previousData.gzippedSize) * 100 : 0,
      threshold: CONFIG.thresholds.gzippedSize.critical,
      recommendation: 'Critical: Optimize compression and remove redundant code',
    });
  }
  
  // Check chunk size regressions
  Object.entries(bundleSizeData.chunks).forEach(([chunkName, size]) => {
    if (size > CONFIG.thresholds.chunkSize.critical) {
      bundleSizeData.alerts.push({
        type: 'chunk_size_increase',
        severity: 'critical',
        message: `Chunk ${chunkName} exceeded critical size: ${formatBytes(size)}`,
        current: size,
        previous: 0,
        change: size,
        changePercent: 0,
        threshold: CONFIG.thresholds.chunkSize.critical,
        recommendation: `Critical: Split chunk ${chunkName} into smaller pieces`,
      });
    }
  });
  
  console.log(`🚨 Found ${bundleSizeData.alerts.length} regressions`);
}

// Generate optimization recommendations
async function generateRecommendations() {
  const recommendations = [];
  
  // Bundle size recommendations
  if (bundleSizeData.totalSize > CONFIG.thresholds.bundleSize.warning) {
    recommendations.push('Consider implementing more aggressive code splitting');
    recommendations.push('Review and remove unused dependencies');
    recommendations.push('Optimize images and assets');
    recommendations.push('Implement lazy loading for non-critical components');
  }
  
  // Compression recommendations
  if (bundleSizeData.compressionRatio < 0.7) {
    recommendations.push('Optimize code structure for better compression');
    recommendations.push('Remove redundant code and comments');
    recommendations.push('Use shorter variable names in production builds');
  }
  
  // Chunk size recommendations
  const largeChunks = Object.entries(bundleSizeData.chunks)
    .filter(([_, size]) => size > CONFIG.thresholds.chunkSize.warning);
  
  if (largeChunks.length > 0) {
    recommendations.push(`Consider splitting large chunks: ${largeChunks.map(([name]) => name).join(', ')}`);
  }
  
  bundleSizeData.recommendations = recommendations;
  console.log(`💡 Generated ${recommendations.length} recommendations`);
}

// Save tracking data to file
async function saveTrackingData() {
  const trackingFile = path.join(process.cwd(), CONFIG.trackingFile);
  
  // Load existing data
  let existingData = [];
  if (fs.existsSync(trackingFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
    } catch (error) {
      console.warn('⚠️ Could not load existing tracking data:', error.message);
    }
  }
  
  // Add new data
  existingData.push(bundleSizeData);
  
  // Keep only last 50 builds
  if (existingData.length > 50) {
    existingData = existingData.slice(-50);
  }
  
  // Save to file
  fs.writeFileSync(trackingFile, JSON.stringify(existingData, null, 2));
  console.log(`💾 Saved tracking data to ${trackingFile}`);
}

// Send alerts to configured channels
async function sendAlerts() {
  const criticalAlerts = bundleSizeData.alerts.filter(alert => alert.severity === 'critical');
  const errorAlerts = bundleSizeData.alerts.filter(alert => alert.severity === 'error');
  const warningAlerts = bundleSizeData.alerts.filter(alert => alert.severity === 'warning');
  
  if (criticalAlerts.length > 0) {
    console.log('🚨 CRITICAL ALERTS:');
    criticalAlerts.forEach(alert => {
      console.log(`  - ${alert.message}`);
      console.log(`    Recommendation: ${alert.recommendation}`);
    });
  }
  
  if (errorAlerts.length > 0) {
    console.log('❌ ERROR ALERTS:');
    errorAlerts.forEach(alert => {
      console.log(`  - ${alert.message}`);
      console.log(`    Recommendation: ${alert.recommendation}`);
    });
  }
  
  if (warningAlerts.length > 0) {
    console.log('⚠️ WARNING ALERTS:');
    warningAlerts.forEach(alert => {
      console.log(`  - ${alert.message}`);
      console.log(`    Recommendation: ${alert.recommendation}`);
    });
  }
  
  // TODO: Implement actual alert sending (Slack, email, GitHub, etc.)
  console.log('📢 Alert sending not implemented yet');
}

// Generate performance report
async function generateReport() {
  const report = {
    summary: {
      buildId: bundleSizeData.buildId,
      commitHash: bundleSizeData.commitHash,
      branch: bundleSizeData.branch,
      timestamp: bundleSizeData.timestamp,
      totalSize: bundleSizeData.totalSize,
      gzippedSize: bundleSizeData.gzippedSize,
      compressionRatio: bundleSizeData.compressionRatio,
      alertCount: bundleSizeData.alerts.length,
      recommendationCount: bundleSizeData.recommendations.length,
    },
    metrics: {
      totalSize: formatBytes(bundleSizeData.totalSize),
      gzippedSize: formatBytes(bundleSizeData.gzippedSize),
      compressionRatio: `${(bundleSizeData.compressionRatio * 100).toFixed(1)}%`,
      chunkCount: Object.keys(bundleSizeData.chunks).length,
      assetCount: Object.keys(bundleSizeData.assets).length,
    },
    alerts: bundleSizeData.alerts,
    recommendations: bundleSizeData.recommendations,
  };
  
  const reportFile = path.join(process.cwd(), 'bundle-size-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📋 Generated report: ${reportFile}`);
  
  // Print summary
  console.log('\n📊 Bundle Size Report Summary:');
  console.log(`  Build ID: ${report.summary.buildId}`);
  console.log(`  Commit: ${report.summary.commitHash}`);
  console.log(`  Branch: ${report.summary.branch}`);
  console.log(`  Total Size: ${report.metrics.totalSize}`);
  console.log(`  Gzipped Size: ${report.metrics.gzippedSize}`);
  console.log(`  Compression Ratio: ${report.metrics.compressionRatio}`);
  console.log(`  Chunks: ${report.metrics.chunkCount}`);
  console.log(`  Assets: ${report.metrics.assetCount}`);
  console.log(`  Alerts: ${report.summary.alertCount}`);
  console.log(`  Recommendations: ${report.summary.recommendationCount}`);
}

// Utility function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the script
main().catch(error => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
});
