/**
 * Unified Alert Severity System
 * 
 * Provides consistent severity mapping across all alert types
 * with standardized thresholds and visual indicators.
 */

/**
 * Unified severity levels with consistent definitions
 */
export const SEVERITY_LEVELS = {
  CRITICAL: {
    level: 'critical',
    priority: 1,
    color: 'red',
    icon: '🚨',
    description: 'Immediate action required - system or data integrity at risk',
    threshold: 0.9
  },
  HIGH: {
    level: 'high', 
    priority: 2,
    color: 'orange',
    icon: '⚠️',
    description: 'Significant impact - requires attention within hours',
    threshold: 0.7
  },
  MEDIUM: {
    level: 'medium',
    priority: 3, 
    color: 'yellow',
    icon: '📊',
    description: 'Important change - monitor and consider action',
    threshold: 0.5
  },
  LOW: {
    level: 'low',
    priority: 4,
    color: 'blue', 
    icon: 'ℹ️',
    description: 'Informational - worth noting but not urgent',
    threshold: 0.3
  }
};

/**
 * Severity thresholds for different alert types
 */
export const SEVERITY_THRESHOLDS = {
  // Factor Change Alerts
  factor_change: {
    critical: 30,  // ≥30 point change
    high: 20,      // ≥20 point change  
    medium: 10,    // ≥10 point change
    low: 5         // ≥5 point change
  },
  
  // Cycle Adjustment Alerts
  cycle_adjustment: {
    critical: 15,  // ≥15 point adjustment
    high: 10,      // ≥10 point adjustment
    medium: 5,     // ≥5 point adjustment
    low: 2         // ≥2 point adjustment
  },
  
  // Spike Adjustment Alerts  
  spike_adjustment: {
    critical: 10,  // ≥10 point spike
    high: 6,       // ≥6 point spike
    medium: 3,     // ≥3 point spike
    low: 1         // ≥1 point spike
  },
  
  // 50W SMA Warning Alerts
  sma50w_warning: {
    critical: 6,   // ≥6 weeks below
    high: 4,       // ≥4 weeks below
    medium: 2,     // ≥2 weeks below
    low: 1         // 1 week below
  },
  
  // Risk Band Change Alerts
  risk_band_change: {
    critical: 25,  // ≥25 point score change
    high: 15,      // ≥15 point score change
    medium: 10,    // ≥10 point score change
    low: 5         // ≥5 point score change
  },
  
  // ETF Flow Alerts
  etf_zero_cross: {
    critical: 100, // ≥100M flow change
    high: 50,      // ≥50M flow change
    medium: 25,    // ≥25M flow change
    low: 10        // ≥10M flow change
  },
  
  // Data Freshness Alerts
  data_freshness: {
    critical: 48,  // ≥48 hours stale
    high: 24,      // ≥24 hours stale
    medium: 12,    // ≥12 hours stale
    low: 6         // ≥6 hours stale
  },
  
  // Factor Staleness Alerts
  factor_staleness: {
    critical: 72,  // ≥72 hours stale
    high: 48,      // ≥48 hours stale
    medium: 24,    // ≥24 hours stale
    low: 12        // ≥12 hours stale
  }
};

/**
 * Determine severity based on alert type and magnitude
 */
export function determineSeverity(alertType, magnitude) {
  const thresholds = SEVERITY_THRESHOLDS[alertType];
  if (!thresholds) {
    console.warn(`Unknown alert type: ${alertType}, defaulting to medium severity`);
    return 'medium';
  }
  
  const absMagnitude = Math.abs(magnitude);
  
  if (absMagnitude >= thresholds.critical) return 'critical';
  if (absMagnitude >= thresholds.high) return 'high';
  if (absMagnitude >= thresholds.medium) return 'medium';
  if (absMagnitude >= thresholds.low) return 'low';
  
  // If below low threshold, don't create alert
  return null;
}

/**
 * Get severity configuration for display
 */
export function getSeverityConfig(severity) {
  return SEVERITY_LEVELS[severity.toUpperCase()] || SEVERITY_LEVELS.MEDIUM;
}

/**
 * Get color classes for severity (Tailwind CSS)
 */
export function getSeverityColorClasses(severity) {
  const config = getSeverityConfig(severity);
  
  const colorMap = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200', 
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200'
  };
  
  return colorMap[config.level] || colorMap.medium;
}

/**
 * Get icon for severity level
 */
export function getSeverityIcon(severity) {
  const config = getSeverityConfig(severity);
  return config.icon;
}

/**
 * Get priority number for sorting (lower = higher priority)
 */
export function getSeverityPriority(severity) {
  const config = getSeverityConfig(severity);
  return config.priority;
}

/**
 * Sort alerts by severity priority (critical first)
 */
export function sortAlertsBySeverity(alerts) {
  return alerts.sort((a, b) => {
    const priorityA = getSeverityPriority(a.severity);
    const priorityB = getSeverityPriority(b.severity);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same severity, sort by timestamp (newest first)
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

/**
 * Get severity statistics for alert collections
 */
export function getSeverityStats(alerts) {
  const stats = {
    total: alerts.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    bySeverity: {}
  };
  
  alerts.forEach(alert => {
    const severity = alert.severity || 'medium';
    stats[severity] = (stats[severity] || 0) + 1;
    stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
  });
  
  return stats;
}

/**
 * Validate severity consistency across alert types
 */
export function validateSeverityConsistency(alerts) {
  const issues = [];
  
  alerts.forEach((alert, index) => {
    // Check if severity is valid
    if (!SEVERITY_LEVELS[alert.severity?.toUpperCase()]) {
      issues.push(`Alert ${index}: Invalid severity '${alert.severity}'`);
    }
    
    // Check if severity matches magnitude for known types
    if (SEVERITY_THRESHOLDS[alert.type] && alert.data) {
      const magnitude = Math.abs(alert.data.change_points || alert.data.change || 0);
      const expectedSeverity = determineSeverity(alert.type, magnitude);
      
      if (expectedSeverity && expectedSeverity !== alert.severity) {
        issues.push(`Alert ${index}: Severity mismatch - expected '${expectedSeverity}' for magnitude ${magnitude}, got '${alert.severity}'`);
      }
    }
  });
  
  return {
    valid: issues.length === 0,
    issues: issues
  };
}
