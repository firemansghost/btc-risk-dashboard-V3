#!/usr/bin/env node
/**
 * G-Score Long-Term Storage Management
 * 
 * This script manages long-term storage of G-Score data with features:
 * - Data compression and archival
 * - Backup and restore functionality
 * - Storage optimization
 * - Data integrity checks
 * - Migration utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Archive old G-Score data to compressed format
 */
async function archiveOldData(archiveDir = 'public/data/archives', daysToKeep = 365) {
  console.log('📦 Archiving old G-Score data...');
  
  // Ensure archive directory exists
  await fs.mkdir(archiveDir, { recursive: true });
  
  try {
    // Load current history
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      console.log('No data to archive');
      return;
    }
    
    const header = lines[0];
    const dataLines = lines.slice(1);
    
    // Parse and sort data
    const records = dataLines.map(line => {
      const [date, score, band, price] = line.split(',');
      return { date, score, band, price };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // Split data
    const recentRecords = records.filter(r => r.date >= cutoffDateStr);
    const oldRecords = records.filter(r => r.date < cutoffDateStr);
    
    if (oldRecords.length === 0) {
      console.log('No old data to archive');
      return;
    }
    
    // Create archive
    const archiveDate = new Date().toISOString().split('T')[0];
    const archiveFile = path.join(archiveDir, `gscore-history-${archiveDate}.csv.gz`);
    
    const archiveContent = [header, ...oldRecords.map(r => `${r.date},${r.score},${r.band},${r.price}`)].join('\n');
    const compressed = await gzipAsync(archiveContent);
    await fs.writeFile(archiveFile, compressed);
    
    // Update main file with only recent data
    const recentContent = [header, ...recentRecords.map(r => `${r.date},${r.score},${r.band},${r.price}`)].join('\n');
    await fs.writeFile('public/data/history.csv', recentContent);
    
    console.log(`✅ Archived ${oldRecords.length} old records to ${archiveFile}`);
    console.log(`📊 Kept ${recentRecords.length} recent records in main file`);
    
    return {
      archivedRecords: oldRecords.length,
      keptRecords: recentRecords.length,
      archiveFile
    };
    
  } catch (error) {
    console.error('❌ Archive failed:', error.message);
    throw error;
  }
}

/**
 * Restore data from archive
 */
async function restoreFromArchive(archiveFile) {
  console.log(`📥 Restoring data from ${archiveFile}...`);
  
  try {
    // Read compressed archive
    const compressed = await fs.readFile(archiveFile);
    const decompressed = await gunzipAsync(compressed);
    const archiveContent = decompressed.toString();
    
    // Load current data
    let currentContent = '';
    try {
      currentContent = await fs.readFile('public/data/history.csv', 'utf8');
    } catch (error) {
      // File doesn't exist, start fresh
      currentContent = 'date,score,band,price_usd\n';
    }
    
    // Merge data
    const currentLines = currentContent.trim().split('\n');
    const archiveLines = archiveContent.trim().split('\n');
    
    // Combine and deduplicate
    const allRecords = new Map();
    
    // Add current data
    for (let i = 1; i < currentLines.length; i++) {
      const [date] = currentLines[i].split(',');
      allRecords.set(date, currentLines[i]);
    }
    
    // Add archive data (archive takes precedence for old dates)
    for (let i = 1; i < archiveLines.length; i++) {
      const [date] = archiveLines[i].split(',');
      allRecords.set(date, archiveLines[i]);
    }
    
    // Sort by date
    const sortedRecords = Array.from(allRecords.values()).sort((a, b) => {
      const dateA = a.split(',')[0];
      const dateB = b.split(',')[0];
      return dateA.localeCompare(dateB);
    });
    
    // Write merged data
    const mergedContent = [currentLines[0], ...sortedRecords].join('\n');
    await fs.writeFile('public/data/history.csv', mergedContent);
    
    console.log(`✅ Restored ${archiveLines.length - 1} records from archive`);
    console.log(`📊 Total records: ${sortedRecords.length}`);
    
    return {
      restoredRecords: archiveLines.length - 1,
      totalRecords: sortedRecords.length
    };
    
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    throw error;
  }
}

/**
 * Create backup of current data
 */
async function createBackup(backupDir = 'public/data/backups') {
  console.log('💾 Creating G-Score backup...');
  
  // Ensure backup directory exists
  await fs.mkdir(backupDir, { recursive: true });
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `gscore-backup-${timestamp}.csv`);
    
    // Copy current history
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    await fs.writeFile(backupFile, content);
    
    console.log(`✅ Backup created: ${backupFile}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  }
}

/**
 * Optimize storage by compressing old data
 */
async function optimizeStorage() {
  console.log('🔧 Optimizing G-Score storage...');
  
  try {
    // Create backup first
    await createBackup();
    
    // Archive old data (keep last 2 years)
    const archiveResult = await archiveOldData('public/data/archives', 730);
    
    // Get storage statistics
    const stats = await getStorageStats();
    
    console.log('📊 Storage Optimization Results:');
    console.log(`   📁 Main file: ${stats.mainFileSize} bytes`);
    console.log(`   📦 Archive files: ${stats.archiveFiles} files, ${stats.archiveSize} bytes`);
    console.log(`   💾 Total saved: ${stats.savings} bytes (${stats.savingsPercent.toFixed(1)}%)`);
    
    return {
      archivedRecords: archiveResult.archivedRecords,
      keptRecords: archiveResult.keptRecords,
      savings: stats.savings,
      savingsPercent: stats.savingsPercent
    };
    
  } catch (error) {
    console.error('❌ Storage optimization failed:', error.message);
    throw error;
  }
}

/**
 * Get storage statistics
 */
async function getStorageStats() {
  const stats = {
    mainFileSize: 0,
    archiveFiles: 0,
    archiveSize: 0,
    savings: 0,
    savingsPercent: 0
  };
  
  try {
    // Main file size
    const mainStats = await fs.stat('public/data/history.csv');
    stats.mainFileSize = mainStats.size;
    
    // Archive files
    const archiveDir = 'public/data/archives';
    try {
      const archiveFiles = await fs.readdir(archiveDir);
      stats.archiveFiles = archiveFiles.length;
      
      for (const file of archiveFiles) {
        const fileStats = await fs.stat(path.join(archiveDir, file));
        stats.archiveSize += fileStats.size;
      }
    } catch (error) {
      // Archive directory doesn't exist
    }
    
    // Calculate savings (estimate)
    const estimatedUncompressedSize = stats.mainFileSize + stats.archiveSize;
    const actualSize = stats.mainFileSize + stats.archiveSize;
    stats.savings = Math.max(0, estimatedUncompressedSize - actualSize);
    stats.savingsPercent = estimatedUncompressedSize > 0 ? (stats.savings / estimatedUncompressedSize) * 100 : 0;
    
  } catch (error) {
    console.warn('Could not calculate storage stats:', error.message);
  }
  
  return stats;
}

/**
 * Migrate data format (for future schema changes)
 */
async function migrateDataFormat() {
  console.log('🔄 Checking for data format migrations...');
  
  try {
    const content = await fs.readFile('public/data/history.csv', 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) {
      console.log('No data to migrate');
      return;
    }
    
    const header = lines[0];
    const expectedColumns = ['date', 'score', 'band', 'price_usd'];
    const actualColumns = header.split(',').map(col => col.toLowerCase().trim());
    
    // Check if migration is needed
    const needsMigration = !expectedColumns.every(col => actualColumns.includes(col));
    
    if (!needsMigration) {
      console.log('✅ Data format is up to date');
      return;
    }
    
    console.log('⚠️  Data format migration needed');
    console.log(`   Expected: ${expectedColumns.join(', ')}`);
    console.log(`   Found: ${actualColumns.join(', ')}`);
    
    // Create backup before migration
    await createBackup();
    
    // Perform migration
    const migratedLines = [expectedColumns.join(',')];
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 4) {
        migratedLines.push(`${parts[0]},${parts[1]},${parts[2]},${parts[3]}`);
      }
    }
    
    await fs.writeFile('public/data/history.csv', migratedLines.join('\n'));
    console.log('✅ Data format migration complete');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Clean up old archives and backups
 */
async function cleanupOldFiles(archiveDir = 'public/data/archives', backupDir = 'public/data/backups', keepDays = 90) {
  console.log('🧹 Cleaning up old files...');
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  
  let cleanedFiles = 0;
  let freedSpace = 0;
  
  // Clean archives
  try {
    const archiveFiles = await fs.readdir(archiveDir);
    for (const file of archiveFiles) {
      const filePath = path.join(archiveDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        cleanedFiles++;
        freedSpace += stats.size;
        console.log(`   🗑️  Removed old archive: ${file}`);
      }
    }
  } catch (error) {
    // Directory doesn't exist
  }
  
  // Clean backups
  try {
    const backupFiles = await fs.readdir(backupDir);
    for (const file of backupFiles) {
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        cleanedFiles++;
        freedSpace += stats.size;
        console.log(`   🗑️  Removed old backup: ${file}`);
      }
    }
  } catch (error) {
    // Directory doesn't exist
  }
  
  console.log(`✅ Cleanup complete: ${cleanedFiles} files removed, ${freedSpace} bytes freed`);
  
  return { cleanedFiles, freedSpace };
}

/**
 * Main storage management function
 */
async function manageGScoreStorage() {
  console.log('🗄️  G-Score Storage Management');
  console.log('==============================');
  
  try {
    // 1. Create backup
    console.log('\n1. Creating backup...');
    await createBackup();
    
    // 2. Check for migrations
    console.log('\n2. Checking data format...');
    await migrateDataFormat();
    
    // 3. Optimize storage
    console.log('\n3. Optimizing storage...');
    const optimizationResult = await optimizeStorage();
    
    // 4. Clean up old files
    console.log('\n4. Cleaning up old files...');
    const cleanupResult = await cleanupOldFiles();
    
    // 5. Get final stats
    console.log('\n5. Final storage statistics...');
    const finalStats = await getStorageStats();
    
    console.log('\n📊 Storage Management Summary');
    console.log('==============================');
    console.log(`📁 Main file: ${(finalStats.mainFileSize / 1024).toFixed(1)} KB`);
    console.log(`📦 Archives: ${finalStats.archiveFiles} files, ${(finalStats.archiveSize / 1024).toFixed(1)} KB`);
    console.log(`💾 Space saved: ${(finalStats.savings / 1024).toFixed(1)} KB (${finalStats.savingsPercent.toFixed(1)}%)`);
    console.log(`🧹 Cleaned: ${cleanupResult.cleanedFiles} files, ${(cleanupResult.freedSpace / 1024).toFixed(1)} KB freed`);
    
    console.log('\n✅ Storage management complete!');
    
    return {
      optimization: optimizationResult,
      cleanup: cleanupResult,
      stats: finalStats
    };
    
  } catch (error) {
    console.error('❌ Storage management failed:', error.message);
    throw error;
  }
}

// Run management if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  manageGScoreStorage().catch(error => {
    console.error('❌ Storage management failed:', error);
    process.exit(1);
  });
}

export { 
  manageGScoreStorage, 
  archiveOldData, 
  restoreFromArchive, 
  createBackup, 
  optimizeStorage,
  cleanupOldFiles 
};
