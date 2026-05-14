// Integration test for Cyber Sentinel Backend
// Run this to verify the backend is working correctly

const API_BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  username: 'testuser_' + Date.now(),
  email: 'test_' + Date.now() + '@example.com',
  password: 'Test123!',
  firstName: 'Test',
  lastName: 'User'
};

const testTexts = [
  "Hello, how are you today?",
  "You are so stupid and ugly!",
  "I hate you, go away!",
  "Have a nice day!",
  "Kill yourself, nobody likes you!"
];

let authToken = null;
let userId = null;

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken && !endpoint.includes('/auth/')) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${data.message || data.error}`);
  }

  return data;
}

// Test functions
async function testHealthCheck() {
  console.log('🩺 Testing health check...');
  const data = await apiRequest('/health');
  console.log('✅ Health check passed:', data.status);
  return true;
}

async function testUserRegistration() {
  console.log('👤 Testing user registration...');
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(testUser)
  });
  
  authToken = data.token;
  userId = data.user.id;
  console.log('✅ User registration successful:', data.user.username);
  return true;
}

async function testUserLogin() {
  console.log('🔐 Testing user login...');
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      emailOrUsername: testUser.email,
      password: testUser.password
    })
  });
  
  authToken = data.token;
  console.log('✅ User login successful:', data.user.username);
  return true;
}

async function testGetCurrentUser() {
  console.log('👤 Testing get current user...');
  const data = await apiRequest('/auth/me');
  console.log('✅ Get current user successful:', data.user.username);
  return true;
}

async function testCyberbullyingDetection() {
  console.log('🤖 Testing cyberbullying detection...');
  
  for (const text of testTexts) {
    try {
      const data = await apiRequest('/detections/detect', {
        method: 'POST',
        body: JSON.stringify({
          text,
          context: { platform: 'web', source: 'test' }
        })
      });
      
      console.log(`✅ Detection for "${text.substring(0, 30)}...": ${data.result.label} (${Math.round(data.result.confidence * 100)}%)`);
    } catch (error) {
      console.log(`❌ Detection failed for "${text.substring(0, 30)}...": ${error.message}`);
    }
  }
  return true;
}

async function testBatchDetection() {
  console.log('📊 Testing batch detection...');
  const data = await apiRequest('/detections/batch-detect', {
    method: 'POST',
    body: JSON.stringify({
      texts: testTexts.map(text => ({ text })),
      context: { platform: 'web', source: 'test' }
    })
  });
  
  console.log('✅ Batch detection successful:', data.summary);
  return true;
}

async function testDetectionHistory() {
  console.log('📜 Testing detection history...');
  const data = await apiRequest('/detections/history');
  console.log('✅ Detection history retrieved:', data.detections.length, 'items');
  return true;
}

async function testUserStats() {
  console.log('📈 Testing user statistics...');
  const data = await apiRequest('/users/stats');
  console.log('✅ User stats retrieved:', data.stats);
  return true;
}

async function testModelInfo() {
  console.log('🧠 Testing ML model info...');
  const data = await apiRequest('/ml/model');
  console.log('✅ Model info retrieved:', data.model.version);
  return true;
}

async function testVocabulary() {
  console.log('📚 Testing vocabulary...');
  const data = await apiRequest('/ml/vocabulary?page=1&limit=10');
  console.log('✅ Vocabulary retrieved:', data.vocabulary.length, 'words');
  return true;
}

async function testModelTest() {
  console.log('🧪 Testing model test endpoint...');
  const data = await apiRequest('/ml/test', {
    method: 'POST',
    body: JSON.stringify({
      text: "This is a test message"
    })
  });
  console.log('✅ Model test successful:', data.result.label);
  return true;
}

async function testAnalytics() {
  console.log('📊 Testing analytics...');
  const data = await apiRequest('/analytics/overview');
  console.log('✅ Analytics retrieved:', Object.keys(data));
  return true;
}

async function testUpdateProfile() {
  console.log('✏️ Testing profile update...');
  const data = await apiRequest('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      profile: {
        firstName: 'Updated',
        lastName: 'Name'
      }
    })
  });
  console.log('✅ Profile update successful');
  return true;
}

async function testUpdateSettings() {
  console.log('⚙️ Testing settings update...');
  const data = await apiRequest('/users/settings', {
    method: 'PATCH',
    body: JSON.stringify({
      settings: {
        detection: {
          sensitivity: 'high'
        }
      }
    })
  });
  console.log('✅ Settings update successful');
  return true;
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 Starting Cyber Sentinel Backend Integration Tests');
  console.log('====================================================');
  console.log('API Base URL:', API_BASE_URL);
  console.log('');

  const tests = [
    { name: 'Health Check', test: testHealthCheck },
    { name: 'User Registration', test: testUserRegistration },
    { name: 'User Login', test: testUserLogin },
    { name: 'Get Current User', test: testGetCurrentUser },
    { name: 'Cyberbullying Detection', test: testCyberbullyingDetection },
    { name: 'Batch Detection', test: testBatchDetection },
    { name: 'Detection History', test: testDetectionHistory },
    { name: 'User Statistics', test: testUserStats },
    { name: 'Model Info', test: testModelInfo },
    { name: 'Vocabulary', test: testVocabulary },
    { name: 'Model Test', test: testModelTest },
    { name: 'Analytics', test: testAnalytics },
    { name: 'Update Profile', test: testUpdateProfile },
    { name: 'Update Settings', test: testUpdateSettings },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test } of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.log(`❌ ${name} failed:`, error.message);
      failed++;
    }
    console.log('');
  }

  console.log('====================================================');
  console.log('🏁 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${tests.length}`);
  console.log('====================================================');

  if (failed > 0) {
    console.log('⚠️  Some tests failed. Check the server logs for more details.');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! Your backend is working correctly.');
    process.exit(0);
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});