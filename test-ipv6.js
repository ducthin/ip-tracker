// Test script for IPv6 priority logic
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI(endpoint, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    
    const response = await axios.get(`${BASE_URL}${endpoint}`);
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log(`❌ Error:`, error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting IPv6 priority logic tests...');
  
  // Test current IP detection
  await testAPI('/api/check-my-ip', 'Current IP detection with IPv6 priority');
  
  // Test specific IPv6 addresses
  await testAPI('/api/test-ip/2001:4860:4860::8888', 'Google DNS IPv6');
  
  // Test specific IPv4 addresses  
  await testAPI('/api/test-ip/8.8.8.8', 'Google DNS IPv4');
  
  // Test Vietnam IP (if available)
  await testAPI('/api/test-ip/118.70.12.1', 'Vietnam IP example');
  
  // Test with apiip.net specifically
  await testAPI('/api/test-apiip/2001:4860:4860::8888', 'apiip.net with IPv6');
  
  console.log('\n✨ Tests completed!');
}

runTests();
