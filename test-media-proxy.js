const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_FACEBOOK_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=726438933217292&ext=1749324492&hash=ATtSwKfwMxo4ibnoS_clWj_i5SMx9n5iXkVDGUeRweX37w';

async function testMediaProxy() {
  console.log('🧪 Testing Media Proxy Endpoint\n');

  // Test 1: Health Check
  console.log('1️⃣ Testing health check...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Missing URL parameter
  console.log('\n2️⃣ Testing missing URL parameter...');
  try {
    const response = await fetch(`${BASE_URL}/api/proxy-fb-media`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  // Test 3: Invalid domain
  console.log('\n3️⃣ Testing invalid domain...');
  try {
    const invalidUrl = encodeURIComponent('https://malicious-site.com/fake-media');
    const response = await fetch(`${BASE_URL}/api/proxy-fb-media?url=${invalidUrl}`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  // Test 4: Valid Facebook URL (may fail due to token/media expiry)
  console.log('\n4️⃣ Testing valid Facebook URL...');
  try {
    const encodedUrl = encodeURIComponent(TEST_FACEBOOK_URL);
    const response = await fetch(`${BASE_URL}/api/proxy-fb-media?url=${encodedUrl}`);
    
    console.log(`Status: ${response.status}`);
    console.log('Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
      'x-media-source': response.headers.get('x-media-source'),
      'x-response-time': response.headers.get('x-response-time')
    });

    if (response.ok) {
      console.log('✅ Media proxy successful');
      // Don't log the binary content, just check if we got data
      const buffer = await response.buffer();
      console.log(`📊 Received ${buffer.length} bytes`);
    } else {
      const errorData = await response.json();
      console.log('❌ Media proxy failed:', errorData);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  // Test 5: CORS OPTIONS request
  console.log('\n5️⃣ Testing CORS OPTIONS request...');
  try {
    const response = await fetch(`${BASE_URL}/api/proxy-fb-media`, {
      method: 'OPTIONS'
    });
    console.log(`Status: ${response.status}`);
    console.log('CORS Headers:', {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers')
    });
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
  }

  console.log('\n🏁 Media proxy tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testMediaProxy().catch(console.error);
}

module.exports = { testMediaProxy }; 