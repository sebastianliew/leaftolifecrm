/**
 * Comprehensive Bundles CRUD Test
 * Tests all API endpoints for the Bundles infrastructure
 * 
 * Run: node scripts/comprehensive-bundles-test.cjs
 */

const http = require('http');
const https = require('https');
const dns = require('dns');

// Fix Globe Broadband DNS issue
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

// Test credentials
const TEST_USER = {
  email: 'bem@gyocc.org',
  password: 'Digitalmi$$ion2126!'
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const protocol = isHttps ? https : http;
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Record test result
function recordTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`  ❌ ${name}`);
    if (details) console.log(`     ${details}`);
  }
}

// Login and get auth token
async function login() {
  console.log('\n🔐 Authenticating...');
  try {
    const response = await makeRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: TEST_USER
    });
    
    if (response.status === 200 && response.data.token) {
      console.log(`  ✅ Login successful for ${TEST_USER.email}`);
      return response.data.token;
    } else {
      console.log(`  ❌ Login failed: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`  ❌ Login error: ${error.message}`);
    return null;
  }
}

// Test health endpoint
async function testHealthEndpoint() {
  console.log('\n📡 Testing Health Endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    recordTest('Health endpoint returns 200', response.status === 200);
    recordTest('Health response has status field', response.data?.status === 'ok' || response.data?.status === 'healthy');
  } catch (error) {
    recordTest('Health endpoint accessible', false, error.message);
  }
}

// Test Bundle API endpoints
async function testBundleEndpoints(token) {
  console.log('\n📦 Testing Bundle API Endpoints...');
  
  const authHeaders = { Authorization: `Bearer ${token}` };
  let createdBundleId = null;
  
  // 1. Test GET /api/bundles - List bundles
  console.log('\n  [GET /api/bundles] - List Bundles');
  try {
    const response = await makeRequest(`${API_URL}/bundles`, {
      headers: authHeaders
    });
    recordTest('GET /bundles returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(response.data?.bundles));
    recordTest('Response has pagination', response.data?.pagination !== undefined);
    
    if (response.data?.bundles?.length > 0) {
      recordTest('Bundles have required fields', 
        response.data.bundles[0].name !== undefined &&
        response.data.bundles[0].bundlePrice !== undefined
      );
    }
  } catch (error) {
    recordTest('GET /bundles accessible', false, error.message);
  }
  
  // 2. Test GET /api/bundles/categories
  console.log('\n  [GET /api/bundles/categories] - Get Categories');
  try {
    const response = await makeRequest(`${API_URL}/bundles/categories`, {
      headers: authHeaders
    });
    recordTest('GET /bundles/categories returns 200', response.status === 200);
    recordTest('Response has categories array', Array.isArray(response.data?.categories));
  } catch (error) {
    recordTest('GET /bundles/categories accessible', false, error.message);
  }
  
  // 3. Test GET /api/bundles/stats
  console.log('\n  [GET /api/bundles/stats] - Get Stats');
  try {
    const response = await makeRequest(`${API_URL}/bundles/stats`, {
      headers: authHeaders
    });
    recordTest('GET /bundles/stats returns 200', response.status === 200);
    recordTest('Response has stats object', response.data?.stats !== undefined);
    recordTest('Stats has total field', response.data?.stats?.total !== undefined);
    recordTest('Stats has active field', response.data?.stats?.active !== undefined);
  } catch (error) {
    recordTest('GET /bundles/stats accessible', false, error.message);
  }
  
  // 4. Test GET /api/bundles/popular
  console.log('\n  [GET /api/bundles/popular] - Get Popular Bundles');
  try {
    const response = await makeRequest(`${API_URL}/bundles/popular`, {
      headers: authHeaders
    });
    recordTest('GET /bundles/popular returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(response.data?.bundles));
  } catch (error) {
    recordTest('GET /bundles/popular accessible', false, error.message);
  }
  
  // 5. Test GET /api/bundles/promoted
  console.log('\n  [GET /api/bundles/promoted] - Get Promoted Bundles');
  try {
    const response = await makeRequest(`${API_URL}/bundles/promoted`, {
      headers: authHeaders
    });
    recordTest('GET /bundles/promoted returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(response.data?.bundles));
  } catch (error) {
    recordTest('GET /bundles/promoted accessible', false, error.message);
  }
  
  // 6. Get a product to use for bundle creation
  console.log('\n  [Fetching product for bundle creation]');
  let testProductId = null;
  let testProductName = 'Test Product';
  let testProductPrice = 50;
  
  try {
    const productsResponse = await makeRequest(`${API_URL}/inventory/products?limit=1`, {
      headers: authHeaders
    });
    
    if (productsResponse.status === 200 && productsResponse.data?.products?.length > 0) {
      const product = productsResponse.data.products[0];
      testProductId = product._id;
      testProductName = product.name;
      testProductPrice = product.sellingPrice || 50;
      recordTest('Found product for bundle test', true);
    } else {
      recordTest('Found product for bundle test', false, 'No products available');
    }
  } catch (error) {
    recordTest('Fetch products for bundle test', false, error.message);
  }
  
  // 7. Test POST /api/bundles - Create Bundle
  if (testProductId) {
    console.log('\n  [POST /api/bundles] - Create Bundle');
    const testBundleData = {
      name: `Test Bundle ${Date.now()}`,
      description: 'This is a comprehensive test bundle',
      category: 'Test Category',
      bundleProducts: [{
        productId: testProductId,
        name: testProductName,
        quantity: 2,
        individualPrice: testProductPrice,
        totalPrice: testProductPrice * 2,
        productType: 'product'
      }],
      bundlePrice: testProductPrice * 1.5, // 25% discount
      isActive: true,
      isPromoted: false,
      tags: ['test', 'automated'],
      availableQuantity: 100
    };
    
    try {
      const response = await makeRequest(`${API_URL}/bundles`, {
        method: 'POST',
        headers: authHeaders,
        body: testBundleData
      });
      
      recordTest('POST /bundles returns 201', response.status === 201);
      recordTest('Created bundle has _id', response.data?._id !== undefined);
      recordTest('Created bundle has correct name', response.data?.name === testBundleData.name);
      recordTest('Bundle has calculated savings', response.data?.savings !== undefined);
      recordTest('Bundle has SKU generated', response.data?.sku !== undefined);
      
      if (response.data?._id) {
        createdBundleId = response.data._id;
        console.log(`     Created bundle ID: ${createdBundleId}`);
      }
    } catch (error) {
      recordTest('POST /bundles accessible', false, error.message);
    }
  }
  
  // 8. Test GET /api/bundles/:id - Get Bundle by ID
  if (createdBundleId) {
    console.log('\n  [GET /api/bundles/:id] - Get Bundle by ID');
    try {
      const response = await makeRequest(`${API_URL}/bundles/${createdBundleId}`, {
        headers: authHeaders
      });
      recordTest('GET /bundles/:id returns 200', response.status === 200);
      recordTest('Bundle has correct _id', response.data?._id === createdBundleId);
      recordTest('Bundle has bundleProducts array', Array.isArray(response.data?.bundleProducts));
    } catch (error) {
      recordTest('GET /bundles/:id accessible', false, error.message);
    }
    
    // 9. Test GET /api/bundles/:id/availability
    console.log('\n  [GET /api/bundles/:id/availability] - Check Availability');
    try {
      const response = await makeRequest(`${API_URL}/bundles/${createdBundleId}/availability?quantity=1`, {
        headers: authHeaders
      });
      recordTest('GET /bundles/:id/availability returns 200', response.status === 200);
      recordTest('Response has available field', response.data?.available !== undefined);
    } catch (error) {
      recordTest('GET /bundles/:id/availability accessible', false, error.message);
    }
    
    // 10. Test PUT /api/bundles/:id - Update Bundle
    console.log('\n  [PUT /api/bundles/:id] - Update Bundle');
    try {
      const updateData = {
        name: `Updated Test Bundle ${Date.now()}`,
        description: 'This bundle has been updated',
        isPromoted: true,
        tags: ['test', 'automated', 'updated']
      };
      
      const response = await makeRequest(`${API_URL}/bundles/${createdBundleId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: updateData
      });
      
      recordTest('PUT /bundles/:id returns 200', response.status === 200);
      recordTest('Bundle name was updated', response.data?.name === updateData.name);
      recordTest('Bundle isPromoted was updated', response.data?.isPromoted === true);
      recordTest('Bundle tags were updated', response.data?.tags?.includes('updated'));
    } catch (error) {
      recordTest('PUT /bundles/:id accessible', false, error.message);
    }
    
    // 11. Test DELETE /api/bundles/:id - Delete Bundle
    console.log('\n  [DELETE /api/bundles/:id] - Delete Bundle');
    try {
      const response = await makeRequest(`${API_URL}/bundles/${createdBundleId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      recordTest('DELETE /bundles/:id returns 200', response.status === 200);
      recordTest('Delete response has success message', response.data?.message !== undefined);
      
      // Verify deletion
      const verifyResponse = await makeRequest(`${API_URL}/bundles/${createdBundleId}`, {
        headers: authHeaders
      });
      recordTest('Bundle no longer exists (404)', verifyResponse.status === 404);
    } catch (error) {
      recordTest('DELETE /bundles/:id accessible', false, error.message);
    }
  }
  
  // 12. Test POST /api/bundles/calculate-pricing
  if (testProductId) {
    console.log('\n  [POST /api/bundles/calculate-pricing] - Calculate Pricing');
    try {
      const pricingData = {
        bundleProducts: [{
          productId: testProductId,
          name: testProductName,
          quantity: 3,
          individualPrice: testProductPrice,
          productType: 'product'
        }],
        bundlePrice: testProductPrice * 2.5
      };
      
      const response = await makeRequest(`${API_URL}/bundles/calculate-pricing`, {
        method: 'POST',
        headers: authHeaders,
        body: pricingData
      });
      
      recordTest('POST /bundles/calculate-pricing returns 200', response.status === 200);
      recordTest('Response has individualTotalPrice', response.data?.individualTotalPrice !== undefined);
      recordTest('Response has savings', response.data?.savings !== undefined);
      recordTest('Response has savingsPercentage', response.data?.savingsPercentage !== undefined);
    } catch (error) {
      recordTest('POST /bundles/calculate-pricing accessible', false, error.message);
    }
  }
  
  // 13. Test search/filter functionality
  console.log('\n  [GET /api/bundles with filters] - Search & Filter');
  try {
    const response = await makeRequest(`${API_URL}/bundles?search=wellness&isActive=true&limit=5`, {
      headers: authHeaders
    });
    recordTest('GET /bundles with search returns 200', response.status === 200);
    recordTest('Filtered response has bundles array', Array.isArray(response.data?.bundles));
  } catch (error) {
    recordTest('GET /bundles with filters accessible', false, error.message);
  }
  
  // 14. Test pagination
  console.log('\n  [GET /api/bundles with pagination] - Pagination');
  try {
    const response = await makeRequest(`${API_URL}/bundles?page=1&limit=5`, {
      headers: authHeaders
    });
    recordTest('GET /bundles with pagination returns 200', response.status === 200);
    recordTest('Pagination page is correct', response.data?.pagination?.page === 1);
    recordTest('Pagination limit is correct', response.data?.pagination?.limit === 5);
  } catch (error) {
    recordTest('GET /bundles with pagination accessible', false, error.message);
  }
  
  // 15. Test getAllBundles parameter
  console.log('\n  [GET /api/bundles?getAllBundles=true] - Get All Without Pagination');
  try {
    const response = await makeRequest(`${API_URL}/bundles?getAllBundles=true`, {
      headers: authHeaders
    });
    recordTest('GET /bundles with getAllBundles returns 200', response.status === 200);
    recordTest('Returns all bundles', response.data?.pagination?.page === 1);
  } catch (error) {
    recordTest('GET /bundles with getAllBundles accessible', false, error.message);
  }
}

// Test authentication requirements
async function testAuthRequirements() {
  console.log('\n🔒 Testing Authentication Requirements...');
  
  // Test without auth token
  try {
    const response = await makeRequest(`${API_URL}/bundles`);
    recordTest('GET /bundles requires auth (401 without token)', response.status === 401);
  } catch (error) {
    recordTest('Auth check accessible', false, error.message);
  }
  
  // Test with invalid token
  try {
    const response = await makeRequest(`${API_URL}/bundles`, {
      headers: { Authorization: 'Bearer invalid_token_12345' }
    });
    recordTest('GET /bundles rejects invalid token (401)', response.status === 401 || response.status === 403);
  } catch (error) {
    recordTest('Invalid token check accessible', false, error.message);
  }
}

// Print final results
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ Passed: ${testResults.passed}`);
  console.log(`  ❌ Failed: ${testResults.failed}`);
  console.log(`  📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log('='.repeat(60));
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}${t.details ? `: ${t.details}` : ''}`));
  }
  
  const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
  console.log(`\n📈 Pass Rate: ${passRate}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Bundle CRUD infrastructure is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the issues above.');
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 COMPREHENSIVE BUNDLES CRUD TEST');
  console.log('='.repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`User: ${TEST_USER.email}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  // Test health endpoint
  await testHealthEndpoint();
  
  // Test auth requirements
  await testAuthRequirements();
  
  // Login and get token
  const token = await login();
  
  if (!token) {
    console.log('\n⛔ Cannot proceed without authentication. Exiting.');
    printResults();
    process.exit(1);
  }
  
  // Test bundle endpoints
  await testBundleEndpoints(token);
  
  // Print final results
  printResults();
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
