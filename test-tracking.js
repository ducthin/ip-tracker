// IPv6 tracking simulation test
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function createTestLink() {
  try {
    const response = await axios.post(`${BASE_URL}/api/create-link`, {
      name: 'IPv6 Test Link',
      originalUrl: 'https://google.com',
      customPath: 'ipv6-test'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating test link:', error.message);
    return null;
  }
}

async function simulateVisit(linkPath, headers = {}) {
  try {
    const response = await axios.get(`${BASE_URL}/${linkPath}`, {
      headers: headers,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    console.log(`✅ Visit simulated: ${linkPath} -> Status: ${response.status}`);
    return true;
  } catch (error) {
    if (error.response && error.response.status >= 300 && error.response.status < 400) {
      console.log(`✅ Visit simulated: ${linkPath} -> Redirected: ${error.response.status}`);
      return true;
    }
    console.error(`❌ Error visiting ${linkPath}:`, error.message);
    return false;
  }
}

async function checkStats() {
  try {
    const response = await axios.get(`${BASE_URL}/api/ip-stats`);
    console.log('\n📊 Current IP Statistics:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error checking stats:', error.message);
  }
}

async function runIPv6TrackingTest() {
  console.log('🚀 Starting IPv6 tracking simulation test...\n');
  
  // Tạo test link
  console.log('1. Creating test link...');
  const linkData = await createTestLink();
  if (!linkData) {
    console.log('❌ Failed to create test link');
    return;
  }
  
  console.log(`✅ Test link created: ${linkData.trackingUrl}`);
  console.log(`📊 Admin URL: ${linkData.adminUrl}\n`);
  
  // Simulate IPv6 visits with different headers
  console.log('2. Simulating IPv6 visits...');
  
  const ipv6Headers = [
    { 'x-forwarded-for': '2001:4860:4860::8888' },
    { 'x-real-ip': '2001:4860:4860::8844' },
    { 'cf-connecting-ip': '2001:db8::1' }
  ];
  
  for (let i = 0; i < ipv6Headers.length; i++) {
    console.log(`   Simulating IPv6 visit ${i + 1}/3...`);
    await simulateVisit(linkData.shortPath, ipv6Headers[i]);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  }
  
  // Simulate IPv4 visits
  console.log('\n3. Simulating IPv4 visits...');
  
  const ipv4Headers = [
    { 'x-forwarded-for': '8.8.8.8' },
    { 'x-real-ip': '1.1.1.1' },
    { 'cf-connecting-ip': '118.70.12.1' }
  ];
  
  for (let i = 0; i < ipv4Headers.length; i++) {
    console.log(`   Simulating IPv4 visit ${i + 1}/3...`);
    await simulateVisit(linkData.shortPath, ipv4Headers[i]);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  }
  
  // Check final statistics
  console.log('\n4. Checking final statistics...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for DB writes
  await checkStats();
  
  console.log('\n✨ IPv6 tracking test completed!');
  console.log(`📊 View analytics: ${BASE_URL}/analytics`);
  console.log(`🧪 Test IPv6 features: ${BASE_URL}/test-ipv6`);
}

runIPv6TrackingTest();
