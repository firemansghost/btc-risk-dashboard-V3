/**
 * Alert Deduplication Utility
 * 
 * Provides comprehensive deduplication for alert generation to prevent:
 * - Duplicate alerts during ETL retries
 * - Alert spam from multiple runs
 * - Data integrity issues
 */

import crypto from 'node:crypto';

/**
 * Generate a unique ID for an alert based on its content
 * This ensures the same alert content always gets the same ID
 */
export function generateAlertId(alert) {
  // Create a hash based on alert content for idempotency
  const contentString = JSON.stringify({
    type: alert.type,
    factor: alert.factor || alert.factorKey,
    timestamp: alert.timestamp,
    // Include key identifying fields but exclude generated fields like ID
    ...(alert.data && {
      previous_score: alert.data.previous_score,
      current_score: alert.data.current_score,
      change_points: alert.data.change_points
    })
  });
  
  return crypto.createHash('sha256').update(contentString).digest('hex').substring(0, 16);
}

/**
 * Check if an alert is a duplicate based on content similarity
 * This prevents near-duplicates that might slip through ID-based deduplication
 */
export function isDuplicateAlert(newAlert, existingAlert) {
  // Same type and factor
  if (newAlert.type !== existingAlert.type) return false;
  if (newAlert.factor !== existingAlert.factor && newAlert.factorKey !== existingAlert.factorKey) return false;
  
  // Same timestamp (within 1 hour tolerance for ETL retries)
  const newTime = new Date(newAlert.timestamp);
  const existingTime = new Date(existingAlert.timestamp);
  const timeDiff = Math.abs(newTime - existingTime);
  const oneHour = 60 * 60 * 1000;
  
  if (timeDiff > oneHour) return false;
  
  // Same change magnitude (within 1 point tolerance)
  if (newAlert.data && existingAlert.data) {
    const newChange = Math.abs(newAlert.data.change_points || 0);
    const existingChange = Math.abs(existingAlert.data.change_points || 0);
    if (Math.abs(newChange - existingChange) > 1) return false;
  }
  
  return true;
}

/**
 * Deduplicate alerts array using multiple strategies
 */
export function deduplicateAlerts(alerts) {
  const seen = new Set();
  const seenByContent = new Map();
  const deduplicated = [];
  
  for (const alert of alerts) {
    // Strategy 1: Unique ID deduplication
    const alertId = generateAlertId(alert);
    if (seen.has(alertId)) {
      console.log(`🔄 Skipping duplicate alert by ID: ${alertId}`);
      continue;
    }
    
    // Strategy 2: Content-based deduplication
    let isContentDuplicate = false;
    for (const [contentKey, existingAlert] of seenByContent) {
      if (isDuplicateAlert(alert, existingAlert)) {
        console.log(`🔄 Skipping duplicate alert by content: ${contentKey}`);
        isContentDuplicate = true;
        break;
      }
    }
    
    if (isContentDuplicate) continue;
    
    // Add to deduplicated list
    const alertWithId = {
      ...alert,
      id: alertId,
      generated_at: new Date().toISOString()
    };
    
    deduplicated.push(alertWithId);
    seen.add(alertId);
    
    // Store for content-based checking
    const contentKey = `${alert.type}_${alert.factor || alert.factorKey}_${alert.timestamp}`;
    seenByContent.set(contentKey, alertWithId);
  }
  
  return deduplicated;
}

/**
 * Merge new alerts with existing alerts and deduplicate
 */
export function mergeAndDeduplicateAlerts(existingAlerts, newAlerts) {
  console.log(`📊 Merging ${existingAlerts.length} existing + ${newAlerts.length} new alerts`);
  
  // Combine all alerts
  const allAlerts = [...existingAlerts, ...newAlerts];
  
  // Deduplicate
  const deduplicated = deduplicateAlerts(allAlerts);
  
  // Sort by timestamp (newest first)
  deduplicated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const duplicatesRemoved = allAlerts.length - deduplicated.length;
  if (duplicatesRemoved > 0) {
    console.log(`✅ Removed ${duplicatesRemoved} duplicate alerts`);
  }
  
  return deduplicated;
}

/**
 * Clean up old alerts (older than retention period)
 */
export function cleanupOldAlerts(alerts, retentionDays = 30) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const filtered = alerts.filter(alert => {
    const alertDate = new Date(alert.timestamp);
    return alertDate > cutoffDate;
  });
  
  const removed = alerts.length - filtered.length;
  if (removed > 0) {
    console.log(`🗑️  Removed ${removed} alerts older than ${retentionDays} days`);
  }
  
  return filtered;
}

/**
 * Comprehensive alert management with deduplication
 */
export function manageAlertsWithDeduplication(existingAlerts, newAlerts, options = {}) {
  const {
    retentionDays = 30,
    maxAlerts = 1000
  } = options;
  
  console.log('🔧 Managing alerts with deduplication...');
  
  // Step 1: Merge and deduplicate
  const merged = mergeAndDeduplicateAlerts(existingAlerts, newAlerts);
  
  // Step 2: Clean up old alerts
  const cleaned = cleanupOldAlerts(merged, retentionDays);
  
  // Step 3: Limit total alerts
  const limited = cleaned.slice(0, maxAlerts);
  
  if (cleaned.length > maxAlerts) {
    console.log(`📊 Limited to ${maxAlerts} most recent alerts`);
  }
  
  return {
    alerts: limited,
    stats: {
      original: existingAlerts.length,
      new: newAlerts.length,
      merged: merged.length,
      cleaned: cleaned.length,
      final: limited.length,
      duplicatesRemoved: (existingAlerts.length + newAlerts.length) - merged.length,
      oldRemoved: merged.length - cleaned.length
    }
  };
}
