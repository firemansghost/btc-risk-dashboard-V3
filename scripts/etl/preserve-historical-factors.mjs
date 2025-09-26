#!/usr/bin/env node
/**
 * Preserve Historical Factors Script
 * 
 * This script ensures that the historical factor data we created is preserved
 * when the ETL runs, rather than being overwritten with new data.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Backup historical factor data before ETL runs
 */
async function backupHistoricalFactors() {
  console.log('💾 Backing up historical factor data...');
  
  const signalsDir = 'public/signals';
  const backupDir = 'public/signals/backup';
  
  // Ensure backup directory exists
  await fs.mkdir(backupDir, { recursive: true });
  
  const factorFiles = [
    'mayer_multiple.csv',
    'dxy_20d.csv', 
    'fear_greed.csv'
  ];
  
  const backupResults = {};
  
  for (const fileName of factorFiles) {
    const sourcePath = path.join(signalsDir, fileName);
    const backupPath = path.join(backupDir, fileName);
    
    try {
      // Check if source file exists and has historical data
      const content = await fs.readFile(sourcePath, 'utf8');
      const lines = content.trim().split('\n');
      
      if (lines.length > 10) { // Has historical data
        await fs.writeFile(backupPath, content);
        backupResults[fileName] = { 
          success: true, 
          records: lines.length - 1,
          message: `Backed up ${lines.length - 1} records`
        };
        console.log(`✅ ${fileName}: ${lines.length - 1} records backed up`);
      } else {
        backupResults[fileName] = { 
          success: false, 
          message: 'No historical data to backup'
        };
        console.log(`⚠️  ${fileName}: No historical data found`);
      }
    } catch (error) {
      backupResults[fileName] = { 
        success: false, 
        message: `Backup failed: ${error.message}`
      };
      console.log(`❌ ${fileName}: Backup failed - ${error.message}`);
    }
  }
  
  return backupResults;
}

/**
 * Restore historical factor data after ETL runs
 */
async function restoreHistoricalFactors() {
  console.log('🔄 Restoring historical factor data...');
  
  const signalsDir = 'public/signals';
  const backupDir = 'public/signals/backup';
  
  const factorFiles = [
    'mayer_multiple.csv',
    'dxy_20d.csv',
    'fear_greed.csv'
  ];
  
  const restoreResults = {};
  
  for (const fileName of factorFiles) {
    const backupPath = path.join(backupDir, fileName);
    const targetPath = path.join(signalsDir, fileName);
    
    try {
      // Check if backup exists
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backupLines = backupContent.trim().split('\n');
      
      if (backupLines.length > 10) { // Has historical data
        // Load current file to get today's data
        let currentContent = '';
        try {
          currentContent = await fs.readFile(targetPath, 'utf8');
        } catch (error) {
          // File doesn't exist, use backup
          await fs.writeFile(targetPath, backupContent);
          restoreResults[fileName] = { 
            success: true, 
            message: 'Restored from backup (no current file)'
          };
          console.log(`✅ ${fileName}: Restored from backup`);
          continue;
        }
        
        const currentLines = currentContent.trim().split('\n');
        const header = currentLines[0];
        
        // Get today's data (last line if it's newer than backup)
        const today = new Date().toISOString().split('T')[0];
        const todayLine = currentLines.find(line => line.startsWith(today));
        
        // Merge: historical data from backup + today's data
        const mergedLines = [header];
        
        // Add historical data from backup
        for (let i = 1; i < backupLines.length; i++) {
          mergedLines.push(backupLines[i]);
        }
        
        // Add today's data if it exists and is newer
        if (todayLine) {
          mergedLines.push(todayLine);
        }
        
        // Write merged data
        await fs.writeFile(targetPath, mergedLines.join('\n'));
        
        restoreResults[fileName] = { 
          success: true, 
          message: `Merged ${backupLines.length - 1} historical + ${todayLine ? 1 : 0} current records`
        };
        console.log(`✅ ${fileName}: Merged historical and current data`);
        
      } else {
        restoreResults[fileName] = { 
          success: false, 
          message: 'No historical backup data'
        };
        console.log(`⚠️  ${fileName}: No historical backup data`);
      }
      
    } catch (error) {
      restoreResults[fileName] = { 
        success: false, 
        message: `Restore failed: ${error.message}`
      };
      console.log(`❌ ${fileName}: Restore failed - ${error.message}`);
    }
  }
  
  return restoreResults;
}

/**
 * Main preservation function
 */
async function preserveHistoricalFactors() {
  console.log('🛡️  Preserving Historical Factors');
  console.log('==================================');
  
  try {
    // Step 1: Backup historical data
    console.log('\n1. Backing up historical data...');
    const backupResults = await backupHistoricalFactors();
    
    // Step 2: Wait a moment for ETL to potentially run
    console.log('\n2. Historical data backed up successfully');
    console.log('   You can now run the ETL, and then run this script again to restore');
    
    // Step 3: Show backup summary
    console.log('\n📋 Backup Summary:');
    for (const [fileName, result] of Object.entries(backupResults)) {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${fileName}: ${result.message}`);
    }
    
    return backupResults;
    
  } catch (error) {
    console.error('❌ Preservation failed:', error.message);
    throw error;
  }
}

/**
 * Restore function (run after ETL)
 */
async function restoreAfterETL() {
  console.log('🔄 Restoring Historical Factors After ETL');
  console.log('==========================================');
  
  try {
    const restoreResults = await restoreHistoricalFactors();
    
    console.log('\n📋 Restore Summary:');
    for (const [fileName, result] of Object.entries(restoreResults)) {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${fileName}: ${result.message}`);
    }
    
    return restoreResults;
    
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    throw error;
  }
}

// Run based on command line arguments
const command = process.argv[2] || 'backup';

if (command === 'backup') {
  preserveHistoricalFactors().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} else if (command === 'restore') {
  restoreAfterETL().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} else {
  console.log('Usage: node preserve-historical-factors.mjs [backup|restore]');
  process.exit(1);
}
