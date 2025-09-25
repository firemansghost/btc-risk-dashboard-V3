#!/usr/bin/env node
/**
 * Enhanced G-Score Tracking Integration
 * 
 * This script integrates all G-Score tracking improvements:
 * - Historical backfill
 * - Data quality validation
 * - Storage management
 * - Automated maintenance
 */

import { backfillHistoricalGScores } from './backfill-gscore-history.mjs';
import { validateGScoreQuality } from './validate-gscore-quality.mjs';
import { manageGScoreStorage } from './manage-gscore-storage.mjs';

/**
 * Run comprehensive G-Score tracking enhancement
 */
async function enhanceGScoreTracking(options = {}) {
  const {
    enableBackfill = true,
    enableValidation = true,
    enableStorageManagement = true,
    forceBackfill = false
  } = options;
  
  console.log('🚀 Enhanced G-Score Tracking');
  console.log('============================');
  console.log(`📊 Backfill: ${enableBackfill ? 'Enabled' : 'Disabled'}`);
  console.log(`🔍 Validation: ${enableValidation ? 'Enabled' : 'Disabled'}`);
  console.log(`🗄️  Storage: ${enableStorageManagement ? 'Enabled' : 'Disabled'}`);
  console.log('');
  
  const results = {
    backfill: null,
    validation: null,
    storage: null,
    success: true,
    errors: []
  };
  
  try {
    // 1. Historical Backfill
    if (enableBackfill) {
      console.log('📈 Step 1: Historical G-Score Backfill');
      console.log('=====================================');
      
      try {
        results.backfill = await backfillHistoricalGScores();
        console.log('✅ Historical backfill completed');
      } catch (error) {
        console.error('❌ Historical backfill failed:', error.message);
        results.errors.push(`Backfill: ${error.message}`);
        results.success = false;
      }
    }
    
    // 2. Data Quality Validation
    if (enableValidation) {
      console.log('\n🔍 Step 2: Data Quality Validation');
      console.log('==================================');
      
      try {
        results.validation = await validateGScoreQuality();
        console.log('✅ Data quality validation completed');
      } catch (error) {
        console.error('❌ Data quality validation failed:', error.message);
        results.errors.push(`Validation: ${error.message}`);
        results.success = false;
      }
    }
    
    // 3. Storage Management
    if (enableStorageManagement) {
      console.log('\n🗄️  Step 3: Storage Management');
      console.log('==============================');
      
      try {
        results.storage = await manageGScoreStorage();
        console.log('✅ Storage management completed');
      } catch (error) {
        console.error('❌ Storage management failed:', error.message);
        results.errors.push(`Storage: ${error.message}`);
        results.success = false;
      }
    }
    
    // 4. Summary Report
    console.log('\n📋 Enhancement Summary');
    console.log('=====================');
    
    if (results.backfill) {
      console.log(`📈 Backfill: ${results.backfill.newRecords || 0} new records`);
    }
    
    if (results.validation) {
      const qualityScore = Math.max(0, 100 - (results.validation.issues?.total || 0) * 10);
      console.log(`🔍 Quality Score: ${qualityScore}/100`);
    }
    
    if (results.storage) {
      console.log(`🗄️  Storage: ${results.storage.stats?.savingsPercent?.toFixed(1) || 0}% space saved`);
    }
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (results.success) {
      console.log('\n✅ G-Score tracking enhancement completed successfully!');
    } else {
      console.log('\n⚠️  G-Score tracking enhancement completed with errors');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Enhancement failed:', error.message);
    results.success = false;
    results.errors.push(`Enhancement: ${error.message}`);
    return results;
  }
}

/**
 * Quick validation check
 */
async function quickValidation() {
  console.log('🔍 Quick G-Score Validation');
  console.log('============================');
  
  try {
    const results = await validateGScoreQuality();
    
    const qualityScore = Math.max(0, 100 - (results.issues?.total || 0) * 10);
    
    if (qualityScore >= 90) {
      console.log('✅ Data quality is excellent');
    } else if (qualityScore >= 70) {
      console.log('⚠️  Data quality is good with minor issues');
    } else if (qualityScore >= 50) {
      console.log('⚠️  Data quality is fair with several issues');
    } else {
      console.log('❌ Data quality is poor - needs attention');
    }
    
    return { qualityScore, issues: results.issues?.total || 0 };
    
  } catch (error) {
    console.error('❌ Quick validation failed:', error.message);
    return { qualityScore: 0, issues: -1 };
  }
}

/**
 * Maintenance mode - run all enhancements
 */
async function maintenanceMode() {
  console.log('🔧 G-Score Maintenance Mode');
  console.log('===========================');
  
  const results = await enhanceGScoreTracking({
    enableBackfill: true,
    enableValidation: true,
    enableStorageManagement: true
  });
  
  return results;
}

// Run enhancement if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0] || 'enhance';
  
  switch (command) {
    case 'enhance':
      enhanceGScoreTracking().catch(error => {
        console.error('❌ Enhancement failed:', error);
        process.exit(1);
      });
      break;
      
    case 'validate':
      quickValidation().catch(error => {
        console.error('❌ Validation failed:', error);
        process.exit(1);
      });
      break;
      
    case 'maintenance':
      maintenanceMode().catch(error => {
        console.error('❌ Maintenance failed:', error);
        process.exit(1);
      });
      break;
      
    default:
      console.log('Usage: node enhanced-gscore-tracking.mjs [enhance|validate|maintenance]');
      process.exit(1);
  }
}

export { 
  enhanceGScoreTracking, 
  quickValidation, 
  maintenanceMode 
};
