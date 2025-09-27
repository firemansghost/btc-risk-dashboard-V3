#!/usr/bin/env node
/**
 * Test ETF Backfill Script
 */

console.log('🚀 Testing ETF Backfill Script');
console.log('==============================');

// Test basic functionality
console.log('✅ Script is running');

// Test date generation
const startDate = '2024-01-11';
const endDate = new Date().toISOString().split('T')[0];
console.log(`📅 Date range: ${startDate} to ${endDate}`);

// Test ETF launch dates
const ETF_LAUNCH_DATES = {
  'IBIT': '2024-01-11',
  'FBTC': '2024-01-11',
  'BITB': '2024-01-11',
  'ARKB': '2024-01-11'
};

console.log('🏢 ETF Launch Dates:');
Object.entries(ETF_LAUNCH_DATES).forEach(([symbol, date]) => {
  console.log(`   ${symbol}: ${date}`);
});

// Test date range generation
function generateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  
  return dates;
}

const dates = generateDateRange(startDate, endDate);
console.log(`📊 Generated ${dates.length} trading days`);
console.log(`   First 5 dates: ${dates.slice(0, 5).join(', ')}`);
console.log(`   Last 5 dates: ${dates.slice(-5).join(', ')}`);

console.log('\n🎉 Test completed successfully!');

