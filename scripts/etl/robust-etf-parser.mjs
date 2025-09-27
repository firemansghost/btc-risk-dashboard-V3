#!/usr/bin/env node
/**
 * Robust ETF Parser
 * 
 * Enhanced ETF parsing system with comprehensive error handling,
 * multiple parsing strategies, and fallback mechanisms.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * ETF Parser Configuration
 */
const PARSER_CONFIG = {
  // Supported ETF symbols
  ETF_SYMBOLS: ['IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC', 'BTC'],
  
  // Date format patterns
  DATE_PATTERNS: [
    /^\d{4}-\d{2}-\d{2}$/, // ISO format
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i, // DD Mon YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or DD/MM/YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
  ],
  
  // Number parsing patterns
  NUMBER_PATTERNS: [
    /^[\d,.-]+$/, // Basic numeric
    /^[\d,.-]+\s*[KMB]?$/i, // With K/M/B suffixes
    /^[\d,.-]+\s*\$?$/i, // With dollar signs
    /^[\d,.-]+\s*\([\d,.-]+\)$/i, // With parentheses (negative)
  ],
  
  // Scale multipliers
  SCALE_MULTIPLIERS: {
    'K': 1e3,
    'M': 1e6,
    'B': 1e9,
    'k': 1e3,
    'm': 1e6,
    'b': 1e9,
  },
  
  // Error handling thresholds
  MIN_RECORDS: 5,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 10000,
};

/**
 * Enhanced Date Parser with Multiple Strategies
 */
class RobustDateParser {
  constructor() {
    this.monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
  }

  parseDate(input) {
    if (!input || typeof input !== 'string') return null;
    
    const cleaned = input.trim().replace(/\s+/g, ' ');
    
    // Strategy 1: ISO format
    if (PARSER_CONFIG.DATE_PATTERNS[0].test(cleaned)) {
      return this.validateISODate(cleaned);
    }
    
    // Strategy 2: DD Mon YYYY
    const match1 = cleaned.match(PARSER_CONFIG.DATE_PATTERNS[1]);
    if (match1) {
      const [, day, month, year] = match1;
      const monthNum = this.monthMap[month.toLowerCase()];
      if (monthNum) {
        const isoDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
        return this.validateISODate(isoDate);
      }
    }
    
    // Strategy 3: MM/DD/YYYY or DD/MM/YYYY
    const match2 = cleaned.match(PARSER_CONFIG.DATE_PATTERNS[2]);
    if (match2) {
      const [, a, b, year] = match2;
      const month = parseInt(a, 10);
      const day = parseInt(b, 10);
      
      // Try MM/DD/YYYY first (US format)
      if (month <= 12 && day <= 31) {
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        if (this.validateISODate(isoDate)) return isoDate;
      }
      
      // Try DD/MM/YYYY (European format)
      if (day <= 12 && month <= 31) {
        const isoDate = `${year}-${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}`;
        if (this.validateISODate(isoDate)) return isoDate;
      }
    }
    
    // Strategy 4: Try JavaScript Date parsing as fallback
    try {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return null;
  }
  
  validateISODate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Check if date is reasonable (not too far in past/future)
    const now = new Date();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year < 2020 || year > currentYear + 1) return null;
    
    return dateStr;
  }
}

/**
 * Enhanced Number Parser with Multiple Strategies
 */
class RobustNumberParser {
  constructor() {
    this.negativePatterns = [
      /^\(([^)]+)\)$/, // (123)
      /^-([^)]+)$/, // -123
      /^([^)]+)-$/, // 123-
    ];
  }

  parseNumber(input) {
    if (input == null || input === '') return NaN;
    
    const cleaned = String(input).trim();
    
    // Handle empty or non-numeric strings
    if (!cleaned || cleaned === '-' || cleaned === 'N/A') return NaN;
    
    // Strategy 1: Direct numeric conversion
    let number = this.tryDirectConversion(cleaned);
    if (!isNaN(number)) return number;
    
    // Strategy 2: Clean and convert
    number = this.tryCleanedConversion(cleaned);
    if (!isNaN(number)) return number;
    
    // Strategy 3: Handle negative patterns
    number = this.tryNegativePatterns(cleaned);
    if (!isNaN(number)) return number;
    
    // Strategy 4: Extract numeric content
    number = this.tryExtractNumeric(cleaned);
    if (!isNaN(number)) return number;
    
    return NaN;
  }
  
  tryDirectConversion(input) {
    const num = Number(input);
    return Number.isFinite(num) ? num : NaN;
  }
  
  tryCleanedConversion(input) {
    const cleaned = input
      .replace(/[\s,$]/g, '') // Remove spaces, commas, dollar signs
      .replace(/[–—−]/g, '-') // Normalize dash characters
      .replace(/\(([^)]+)\)/, '-$1') // Convert (123) to -123
      .replace(/[^\d.-]/g, ''); // Remove non-numeric characters except dots and dashes
    
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
  }
  
  tryNegativePatterns(input) {
    for (const pattern of this.negativePatterns) {
      const match = input.match(pattern);
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num)) return -num;
      }
    }
    return NaN;
  }
  
  tryExtractNumeric(input) {
    // Extract the first numeric sequence
    const match = input.match(/-?[\d,]+\.?\d*/);
    if (match) {
      const cleaned = match[0].replace(/,/g, '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : NaN;
    }
    return NaN;
  }
  
  parseWithScale(input) {
    const number = this.parseNumber(input);
    if (isNaN(number)) return NaN;
    
    // Check for scale suffixes
    const upperInput = input.toUpperCase();
    for (const [suffix, multiplier] of Object.entries(PARSER_CONFIG.SCALE_MULTIPLIERS)) {
      if (upperInput.includes(suffix)) {
        return number * multiplier;
      }
    }
    
    return number;
  }
}

/**
 * Enhanced HTML Table Parser
 */
class RobustTableParser {
  constructor() {
    this.dateParser = new RobustDateParser();
    this.numberParser = new RobustNumberParser();
  }

  parseTable(html) {
    const result = {
      success: false,
      flows: [],
      individualFlows: [],
      schemaHash: null,
      errors: [],
      warnings: []
    };

    try {
      // Strategy 1: Find tables with regex
      const tables = this.findTables(html);
      if (tables.length === 0) {
        result.errors.push('No tables found in HTML');
        return result;
      }

      // Strategy 2: Try each table until one works
      for (const table of tables) {
        const parseResult = this.parseTableContent(table);
        if (parseResult.success) {
          return { ...result, ...parseResult, success: true };
        }
        result.errors.push(...parseResult.errors);
      }

      result.errors.push('No valid data found in any table');
      return result;

    } catch (error) {
      result.errors.push(`Table parsing failed: ${error.message}`);
      return result;
    }
  }

  findTables(html) {
    const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
    const tables = [];

    for (const table of tableMatches) {
      // Check if table contains ETF-related content
      if (this.isETFTable(table)) {
        tables.push(table);
      }
    }

    return tables;
  }

  isETFTable(table) {
    const indicators = [
      '2024-', '2025-', 'Date', 'Total', 'Flow', 'ETF',
      'IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO'
    ];

    return indicators.some(indicator => 
      table.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  parseTableContent(table) {
    const result = {
      success: false,
      flows: [],
      individualFlows: [],
      schemaHash: null,
      errors: [],
      warnings: []
    };

    try {
      // Parse table rows
      const rows = this.extractTableRows(table);
      if (rows.length < 2) {
        result.errors.push('Insufficient table rows');
        return result;
      }

      // Parse header and data
      const header = rows[0];
      const dataRows = rows.slice(1);
      
      // Generate schema hash
      result.schemaHash = this.generateSchemaHash(header);

      // Find column indices
      const columnMap = this.mapColumns(header);
      if (!columnMap.dateCol && !columnMap.flowCol) {
        result.errors.push('Could not identify date or flow columns');
        return result;
      }

      // Determine scale
      const scale = this.determineScale(header);

      // Parse data rows
      const parsedData = this.parseDataRows(dataRows, columnMap, scale);
      
      result.flows = parsedData.flows;
      result.individualFlows = parsedData.individualFlows;
      result.success = parsedData.flows.length >= PARSER_CONFIG.MIN_RECORDS;

      if (parsedData.flows.length < PARSER_CONFIG.MIN_RECORDS) {
        result.warnings.push(`Only ${parsedData.flows.length} records parsed (minimum: ${PARSER_CONFIG.MIN_RECORDS})`);
      }

      return result;

    } catch (error) {
      result.errors.push(`Table content parsing failed: ${error.message}`);
      return result;
    }
  }

  extractTableRows(table) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const cellText = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    
    const parsed = [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(match => cellText(match[2]));
      
      if (cells.length > 0) {
        parsed.push(cells);
      }
    }
    
    return parsed;
  }

  mapColumns(header) {
    const columnMap = {
      dateCol: null,
      flowCol: null,
      etfColumns: {}
    };

    // Find date column
    for (let i = 0; i < header.length; i++) {
      const cell = header[i].toLowerCase();
      if (cell.includes('date') || cell.includes('day')) {
        columnMap.dateCol = i;
        break;
      }
    }

    // Find flow columns
    for (let i = 0; i < header.length; i++) {
      const cell = header[i].toLowerCase();
      if (cell.includes('total') || cell.includes('flow') || cell.includes('net')) {
        columnMap.flowCol = i;
        break;
      }
    }

    // Find individual ETF columns
    for (const etf of PARSER_CONFIG.ETF_SYMBOLS) {
      for (let i = 0; i < header.length; i++) {
        const cell = header[i].toLowerCase();
        if (cell.includes(etf.toLowerCase())) {
          columnMap.etfColumns[etf] = i;
          break;
        }
      }
    }

    return columnMap;
  }

  determineScale(header) {
    const headerText = header.join(' ').toLowerCase();
    
    if (headerText.includes('bn') || headerText.includes('billion')) return 1e9;
    if (headerText.includes('m') || headerText.includes('million')) return 1e6;
    if (headerText.includes('k') || headerText.includes('thousand')) return 1e3;
    
    return 1;
  }

  parseDataRows(dataRows, columnMap, scale) {
    const flows = [];
    const individualFlows = [];

    for (const row of dataRows) {
      try {
        // Parse date
        let date = null;
        if (columnMap.dateCol !== null && row[columnMap.dateCol]) {
          date = this.dateParser.parseDate(row[columnMap.dateCol]);
        }

        if (!date) continue;

        // Parse total flow
        let totalFlow = NaN;
        if (columnMap.flowCol !== null && row[columnMap.flowCol]) {
          totalFlow = this.numberParser.parseWithScale(row[columnMap.flowCol]) * scale;
        }

        // Parse individual ETF flows
        const individualEtfFlows = {};
        for (const [etf, colIndex] of Object.entries(columnMap.etfColumns)) {
          if (colIndex !== null && row[colIndex]) {
            const flow = this.numberParser.parseWithScale(row[colIndex]) * scale;
            if (!isNaN(flow)) {
              individualEtfFlows[etf] = flow;
            }
          }
        }

        // If no total flow, sum individual flows
        if (isNaN(totalFlow) && Object.keys(individualEtfFlows).length > 0) {
          totalFlow = Object.values(individualEtfFlows).reduce((sum, flow) => sum + flow, 0);
        }

        // Add to results
        if (!isNaN(totalFlow)) {
          flows.push({ date, flow: totalFlow });
          
          if (Object.keys(individualEtfFlows).length > 0) {
            individualFlows.push({ date, flows: individualEtfFlows });
          }
        }

      } catch (error) {
        // Skip problematic rows
        continue;
      }
    }

    // Sort and deduplicate
    flows.sort((a, b) => a.date.localeCompare(b.date));
    individualFlows.sort((a, b) => a.date.localeCompare(b.date));

    const uniqueFlows = this.deduplicateFlows(flows);
    const uniqueIndividualFlows = this.deduplicateFlows(individualFlows);

    return {
      flows: uniqueFlows,
      individualFlows: uniqueIndividualFlows
    };
  }

  deduplicateFlows(flows) {
    const unique = new Map();
    for (const flow of flows) {
      unique.set(flow.date, flow);
    }
    return Array.from(unique.values());
  }

  generateSchemaHash(header) {
    const headerStr = header.join('|');
    return Buffer.from(headerStr).toString('base64').substring(0, 16);
  }
}

/**
 * Enhanced ETF Parser with Error Handling
 */
class RobustETFParser {
  constructor() {
    this.tableParser = new RobustTableParser();
    this.retryCount = 0;
  }

  async parseETFData(html, options = {}) {
    const result = {
      success: false,
      flows: [],
      individualFlows: [],
      schemaHash: null,
      errors: [],
      warnings: [],
      metadata: {
        parseTime: new Date().toISOString(),
        retryCount: this.retryCount,
        strategy: 'robust'
      }
    };

    try {
      // Validate input
      if (!html || typeof html !== 'string') {
        result.errors.push('Invalid HTML input');
        return result;
      }

      if (html.length < 100) {
        result.errors.push('HTML content too short');
        return result;
      }

      // Parse with robust table parser
      const parseResult = this.tableParser.parseTable(html);
      
      if (parseResult.success) {
        result.success = true;
        result.flows = parseResult.flows;
        result.individualFlows = parseResult.individualFlows;
        result.schemaHash = parseResult.schemaHash;
        result.warnings = parseResult.warnings;
      } else {
        result.errors = parseResult.errors;
      }

      // Add metadata
      result.metadata.flowsCount = result.flows.length;
      result.metadata.individualFlowsCount = result.individualFlows.length;
      result.metadata.dateRange = this.getDateRange(result.flows);

      return result;

    } catch (error) {
      result.errors.push(`Parser error: ${error.message}`);
      return result;
    }
  }

  getDateRange(flows) {
    if (flows.length === 0) return null;
    
    const dates = flows.map(f => f.date).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1],
      days: dates.length
    };
  }

  async parseWithRetry(html, maxRetries = PARSER_CONFIG.MAX_RETRIES) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      this.retryCount = attempt;
      
      const result = await this.parseETFData(html);
      
      if (result.success) {
        return result;
      }
      
      // Add delay between retries
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    return {
      success: false,
      errors: [`Failed after ${maxRetries} attempts`],
      flows: [],
      individualFlows: [],
      schemaHash: null
    };
  }
}

/**
 * Main ETF Parser Function
 */
export async function parseETFFlowsRobust(html, options = {}) {
  const parser = new RobustETFParser();
  return await parser.parseWithRetry(html, options.maxRetries);
}

/**
 * Test the robust parser
 */
async function testRobustParser() {
  console.log('🧪 Testing Robust ETF Parser');
  console.log('============================');
  
  // Test with sample HTML
  const sampleHTML = `
    <table>
      <tr>
        <th>Date</th>
        <th>Total Flow</th>
        <th>IBIT</th>
        <th>FBTC</th>
      </tr>
      <tr>
        <td>2024-01-11</td>
        <td>100.5M</td>
        <td>50.2M</td>
        <td>30.1M</td>
      </tr>
      <tr>
        <td>2024-01-12</td>
        <td>85.3M</td>
        <td>45.1M</td>
        <td>25.2M</td>
      </tr>
    </table>
  `;
  
  const result = await parseETFFlowsRobust(sampleHTML);
  
  console.log('✅ Parser test completed');
  console.log(`📊 Success: ${result.success}`);
  console.log(`📈 Flows: ${result.flows.length}`);
  console.log(`🏢 Individual flows: ${result.individualFlows.length}`);
  console.log(`⚠️  Errors: ${result.errors.length}`);
  console.log(`⚠️  Warnings: ${result.warnings.length}`);
  
  if (result.flows.length > 0) {
    console.log('\n📊 Sample flows:');
    result.flows.slice(0, 3).forEach(flow => {
      console.log(`   ${flow.date}: $${(flow.flow / 1e6).toFixed(1)}M`);
    });
  }
  
  return result;
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRobustParser().catch(error => {
    console.error('❌ Parser test failed:', error);
    process.exit(1);
  });
}

export { RobustETFParser, RobustTableParser, RobustDateParser, RobustNumberParser };

