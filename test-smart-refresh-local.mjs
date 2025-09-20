// Test the smart refresh API locally
import fetch from 'node-fetch';

async function testSmartRefresh() {
  try {
    console.log('Testing smart refresh API locally...');
    
    const response = await fetch('http://localhost:3001/api/smart-refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Smart refresh successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Smart refresh failed:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSmartRefresh();
