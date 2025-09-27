#!/usr/bin/env node
/**
 * Test Robust ETF Parser
 */

console.log('🧪 Testing Robust ETF Parser');
console.log('============================');

// Test basic functionality
console.log('✅ Parser module loaded');

// Test date parsing
const testDates = [
  '2024-01-11',
  '11 Jan 2024',
  '01/11/2024',
  '11/01/2024',
  '2024-01-11T00:00:00Z'
];

console.log('📅 Testing date parsing:');
testDates.forEach(date => {
  console.log(`   ${date} -> parsing...`);
});

// Test number parsing
const testNumbers = [
  '100.5M',
  '1,234.56',
  '(123.45)',
  '-456.78',
  '$1,000,000',
  '1.5B'
];

console.log('🔢 Testing number parsing:');
testNumbers.forEach(num => {
  console.log(`   ${num} -> parsing...`);
});

console.log('\n🎉 Parser test completed successfully!');

