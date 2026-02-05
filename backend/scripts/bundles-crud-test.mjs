/**
 * Comprehensive Bundles CRUD Test (ES Module with fetch)
 * Tests all API endpoints for the Bundles infrastructure
 * 
 * Run: node scripts/bundles-crud-test.mjs
 */

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
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    
    const data = await response.json();
    
    if (response.ok && (data.token || data.accessToken)) {
      console.log(`  ✅ Login successful for ${TEST_USER.email}`);
      console.log(`     Role: ${data.user?.role}, Name: ${data.user?.displayName}`);
      return data.token || data.accessToken;
    } else {
      console.log(`  ❌ Login failed: ${JSON.stringify(data).substring(0, 200)}`);
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
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    recordTest('Health endpoint returns 200', response.status === 200);
    recordTest('Health response has status field', data?.status === 'OK' || data?.status === 'ok');
    recordTest('Database is connected', data?.database?.connected === true);
  } catch (error) {
    recordTest('Health endpoint accessible', false, error.message);
  }
}

// Test Bundle API endpoints
async function testBundleEndpoints(token) {
  console.log('\n📦 Testing Bundle API Endpoints...');
  
  const authHeaders = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  let createdBundleId = null;
  
  // 1. Test GET /api/bundles - List bundles
  console.log('\n  [GET /api/bundles] - List Bundles');
  try {
    const response = await fetch(`${API_URL}/bundles`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(data?.bundles));
    recordTest('Response has pagination', data?.pagination !== undefined);
    console.log(`     Found ${data?.bundles?.length || 0} bundles`);
    
    if (data?.bundles?.length > 0) {
      recordTest('Bundles have required fields', 
        data.bundles[0].name !== undefined &&
        data.bundles[0].bundlePrice !== undefined
      );
    }
  } catch (error) {
    recordTest('GET /bundles accessible', false, error.message);
  }
  
  // 2. Test GET /api/bundles/categories
  console.log('\n  [GET /api/bundles/categories] - Get Categories');
  try {
    const response = await fetch(`${API_URL}/bundles/categories`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles/categories returns 200', response.status === 200);
    recordTest('Response has categories array', Array.isArray(data?.categories));
    console.log(`     Found ${data?.categories?.length || 0} categories`);
  } catch (error) {
    recordTest('GET /bundles/categories accessible', false, error.message);
  }
  
  // 3. Test GET /api/bundles/stats
  console.log('\n  [GET /api/bundles/stats] - Get Stats');
  try {
    const response = await fetch(`${API_URL}/bundles/stats`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles/stats returns 200', response.status === 200);
    recordTest('Response has stats object', data?.stats !== undefined);
    recordTest('Stats has total field', data?.stats?.total !== undefined);
    recordTest('Stats has active field', data?.stats?.active !== undefined);
    console.log(`     Total: ${data?.stats?.total}, Active: ${data?.stats?.active}, Promoted: ${data?.stats?.promoted}`);
  } catch (error) {
    recordTest('GET /bundles/stats accessible', false, error.message);
  }
  
  // 4. Test GET /api/bundles/popular
  console.log('\n  [GET /api/bundles/popular] - Get Popular Bundles');
  try {
    const response = await fetch(`${API_URL}/bundles/popular`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles/popular returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(data?.bundles));
  } catch (error) {
    recordTest('GET /bundles/popular accessible', false, error.message);
  }
  
  // 5. Test GET /api/bundles/promoted
  console.log('\n  [GET /api/bundles/promoted] - Get Promoted Bundles');
  try {
    const response = await fetch(`${API_URL}/bundles/promoted`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles/promoted returns 200', response.status === 200);
    recordTest('Response has bundles array', Array.isArray(data?.bundles));
  } catch (error) {
    recordTest('GET /bundles/promoted accessible', false, error.message);
  }
  
  // 6. Get a product to use for bundle creation
  console.log('\n  [Fetching product for bundle creation]');
  let testProductId = null;
  let testProductName = 'Test Product';
  let testProductPrice = 50;
  
  try {
    const productsResponse = await fetch(`${API_URL}/inventory/products?limit=1`, { headers: authHeaders });
    const productsData = await productsResponse.json();
    
    if (productsResponse.ok && productsData?.products?.length > 0) {
      const product = productsData.products[0];
      testProductId = product._id;
      testProductName = product.name;
      testProductPrice = product.sellingPrice || 50;
      recordTest('Found product for bundle test', true);
      console.log(`     Using product: ${testProductName} ($${testProductPrice})`);
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
      description: 'This is a comprehensive test bundle created by automated testing',
      category: 'Test Category',
      bundleProducts: [{
        productId: testProductId,
        name: testProductName,
        quantity: 2,
        individualPrice: testProductPrice,
        totalPrice: testProductPrice * 2,
        productType: 'product'
      }],
      bundlePrice: Math.round(testProductPrice * 1.5), // 25% discount
      isActive: true,
      isPromoted: false,
      tags: ['test', 'automated'],
      availableQuantity: 100
    };
    
    try {
      const response = await fetch(`${API_URL}/bundles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(testBundleData)
      });
      const data = await response.json();
      
      recordTest('POST /bundles returns 201', response.status === 201);
      recordTest('Created bundle has _id', data?._id !== undefined);
      recordTest('Created bundle has correct name', data?.name === testBundleData.name);
      recordTest('Bundle has calculated savings', data?.savings !== undefined);
      recordTest('Bundle has SKU generated', data?.sku !== undefined);
      
      if (data?._id) {
        createdBundleId = data._id;
        console.log(`     Created bundle ID: ${createdBundleId}`);
        console.log(`     SKU: ${data.sku}, Savings: $${data.savings} (${data.savingsPercentage}%)`);
      }
    } catch (error) {
      recordTest('POST /bundles accessible', false, error.message);
    }
  }
  
  // 8. Test GET /api/bundles/:id - Get Bundle by ID
  if (createdBundleId) {
    console.log('\n  [GET /api/bundles/:id] - Get Bundle by ID');
    try {
      const response = await fetch(`${API_URL}/bundles/${createdBundleId}`, { headers: authHeaders });
      const data = await response.json();
      recordTest('GET /bundles/:id returns 200', response.status === 200);
      recordTest('Bundle has correct _id', data?._id === createdBundleId);
      recordTest('Bundle has bundleProducts array', Array.isArray(data?.bundleProducts));
    } catch (error) {
      recordTest('GET /bundles/:id accessible', false, error.message);
    }
    
    // 9. Test GET /api/bundles/:id/availability
    console.log('\n  [GET /api/bundles/:id/availability] - Check Availability');
    try {
      const response = await fetch(`${API_URL}/bundles/${createdBundleId}/availability?quantity=1`, { headers: authHeaders });
      const data = await response.json();
      recordTest('GET /bundles/:id/availability returns 200', response.status === 200);
      recordTest('Response has available field', data?.available !== undefined);
      console.log(`     Available: ${data?.available}, Quantity: ${data?.quantity}`);
    } catch (error) {
      recordTest('GET /bundles/:id/availability accessible', false, error.message);
    }
    
    // 10. Test PUT /api/bundles/:id - Update Bundle
    console.log('\n  [PUT /api/bundles/:id] - Update Bundle');
    try {
      const updateData = {
        name: `Updated Test Bundle ${Date.now()}`,
        description: 'This bundle has been updated by automated testing',
        isPromoted: true,
        tags: ['test', 'automated', 'updated']
      };
      
      const response = await fetch(`${API_URL}/bundles/${createdBundleId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updateData)
      });
      const data = await response.json();
      
      recordTest('PUT /bundles/:id returns 200', response.status === 200);
      recordTest('Bundle name was updated', data?.name === updateData.name);
      recordTest('Bundle isPromoted was updated', data?.isPromoted === true);
      recordTest('Bundle tags were updated', data?.tags?.includes('updated'));
      console.log(`     Updated name: ${data?.name}`);
    } catch (error) {
      recordTest('PUT /bundles/:id accessible', false, error.message);
    }
    
    // 11. Test DELETE /api/bundles/:id - Delete Bundle
    console.log('\n  [DELETE /api/bundles/:id] - Delete Bundle');
    try {
      const response = await fetch(`${API_URL}/bundles/${createdBundleId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await response.json();
      
      recordTest('DELETE /bundles/:id returns 200', response.status === 200);
      recordTest('Delete response has success message', data?.message !== undefined);
      console.log(`     ${data?.message}`);
      
      // Verify deletion
      const verifyResponse = await fetch(`${API_URL}/bundles/${createdBundleId}`, { headers: authHeaders });
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
        bundlePrice: Math.round(testProductPrice * 2.5)
      };
      
      const response = await fetch(`${API_URL}/bundles/calculate-pricing`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(pricingData)
      });
      const data = await response.json();
      
      recordTest('POST /bundles/calculate-pricing returns 200', response.status === 200);
      recordTest('Response has individualTotalPrice', data?.individualTotalPrice !== undefined);
      recordTest('Response has savings', data?.savings !== undefined);
      recordTest('Response has savingsPercentage', data?.savingsPercentage !== undefined);
      console.log(`     Individual Total: $${data?.individualTotalPrice}, Bundle: $${data?.bundlePrice}, Savings: ${data?.savingsPercentage}%`);
    } catch (error) {
      recordTest('POST /bundles/calculate-pricing accessible', false, error.message);
    }
  }
  
  // 13. Test search/filter functionality
  console.log('\n  [GET /api/bundles with filters] - Search & Filter');
  try {
    const response = await fetch(`${API_URL}/bundles?isActive=true&limit=5`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles with filters returns 200', response.status === 200);
    recordTest('Filtered response has bundles array', Array.isArray(data?.bundles));
  } catch (error) {
    recordTest('GET /bundles with filters accessible', false, error.message);
  }
  
  // 14. Test pagination
  console.log('\n  [GET /api/bundles with pagination] - Pagination');
  try {
    const response = await fetch(`${API_URL}/bundles?page=1&limit=5`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles with pagination returns 200', response.status === 200);
    recordTest('Pagination page is correct', data?.pagination?.page === 1);
    recordTest('Pagination limit is correct', data?.pagination?.limit === 5);
  } catch (error) {
    recordTest('GET /bundles with pagination accessible', false, error.message);
  }
  
  // 15. Test getAllBundles parameter
  console.log('\n  [GET /api/bundles?getAllBundles=true] - Get All Without Pagination');
  try {
    const response = await fetch(`${API_URL}/bundles?getAllBundles=true`, { headers: authHeaders });
    const data = await response.json();
    recordTest('GET /bundles with getAllBundles returns 200', response.status === 200);
    recordTest('Returns all bundles correctly', data?.pagination?.page === 1);
  } catch (error) {
    recordTest('GET /bundles with getAllBundles accessible', false, error.message);
  }
}

// Test authentication requirements
async function testAuthRequirements() {
  console.log('\n🔒 Testing Authentication Requirements...');
  
  // Test without auth token
  try {
    const response = await fetch(`${API_URL}/bundles`);
    recordTest('GET /bundles requires auth (401 without token)', response.status === 401);
  } catch (error) {
    recordTest('Auth check accessible', false, error.message);
  }
  
  // Test with invalid token
  try {
    const response = await fetch(`${API_URL}/bundles`, {
      headers: { 'Authorization': 'Bearer invalid_token_12345' }
    });
    recordTest('GET /bundles rejects invalid token (401/403)', response.status === 401 || response.status === 403);
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
