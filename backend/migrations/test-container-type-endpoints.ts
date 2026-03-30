/**
 * Comprehensive endpoint test for ContainerType changes.
 *
 * Tests:
 *  1. Login to get auth token
 *  2. GET  /api/inventory/container-types        — list all
 *  3. POST /api/inventory/container-types         — create
 *  4. GET  /api/inventory/container-types/:id     — get by id
 *  5. PUT  /api/inventory/container-types/:id     — update
 *  6. POST /api/inventory/container-types         — validation (missing allowedUomTypes)
 *  7. POST /api/inventory/container-types         — duplicate name
 *  8. POST /api/inventory/products                — create product with containerType
 *  9. GET  /api/inventory/products/:id            — verify containerType populated
 * 10. PUT  /api/inventory/products/:id            — update product containerType
 * 11. DELETE /api/inventory/container-types/:id   — delete (should fail if product linked)
 * 12. DELETE /api/inventory/container-types/:id   — delete unused container type
 * 13. Cleanup: delete test product + test container types
 *
 * Usage:
 *   Ensure backend is running on localhost:5001, then:
 *   npx tsx backend/migrations/test-container-type-endpoints.ts
 */

const BASE = 'http://localhost:5001/api';

let token = '';
let testContainerTypeId = '';
let testContainerType2Id = '';
let testProductId = '';

// Track existing data IDs we need for product creation
let existingCategoryId = '';
let existingUnitId = '';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('\n🔧 Container Type Endpoint Tests\n');

  // ── 1. Login ──
  console.log('1. Login');
  const login = await api('POST', '/auth/login', {
    email: 'bem@gyocc.org',
    password: 'Digitalmi$$Ion2126!'
  });
  if (login.status !== 200) {
    console.log('  ❌ Login failed. Status:', login.status, login.data);
    process.exit(1);
  } else {
    token = login.data.accessToken;
  }
  assert(!!token, 'Authenticated successfully');

  // ── Fetch existing category & unit for product creation ──
  const cats = await api('GET', '/inventory/categories');
  if (cats.data?.categories?.length > 0) {
    existingCategoryId = cats.data.categories[0]._id || cats.data.categories[0].id;
  } else if (Array.isArray(cats.data) && cats.data.length > 0) {
    existingCategoryId = cats.data[0]._id || cats.data[0].id;
  }

  const unitsRes = await api('GET', '/inventory/units');
  const unitsList = unitsRes.data?.units || unitsRes.data || [];
  if (Array.isArray(unitsList) && unitsList.length > 0) {
    existingUnitId = unitsList[0]._id || unitsList[0].id;
  }
  assert(!!existingCategoryId, `Found category: ${existingCategoryId}`);
  assert(!!existingUnitId, `Found unit: ${existingUnitId}`);

  // ── 2. GET /container-types ──
  console.log('\n2. GET /inventory/container-types');
  const listRes = await api('GET', '/inventory/container-types');
  assert(listRes.status === 200, `Status 200 (got ${listRes.status})`);
  const ctList = listRes.data?.containerTypes || listRes.data || [];
  assert(Array.isArray(ctList), `Response is array (length: ${ctList.length})`);
  assert(ctList.length > 0, 'Has container types from migration');
  if (ctList.length > 0) {
    const first = ctList[0];
    assert(!!first.name, `First has name: "${first.name}"`);
    assert(Array.isArray(first.allowedUomTypes), `First has allowedUomTypes: [${first.allowedUomTypes}]`);
  }

  // ── 3. POST /container-types — create ──
  console.log('\n3. POST /inventory/container-types — create');
  const createRes = await api('POST', '/inventory/container-types', {
    name: '__TEST_Ampoule__',
    description: 'Test container type',
    allowedUomTypes: ['volume'],
  });
  assert(createRes.status === 201, `Status 201 (got ${createRes.status})`);
  testContainerTypeId = createRes.data?._id || createRes.data?.id || '';
  assert(!!testContainerTypeId, `Created with ID: ${testContainerTypeId}`);
  assert(createRes.data?.name === '__TEST_Ampoule__', `Name matches`);
  assert(JSON.stringify(createRes.data?.allowedUomTypes) === '["volume"]', `allowedUomTypes = ["volume"]`);

  // Create a second one for deletion test later
  const create2 = await api('POST', '/inventory/container-types', {
    name: '__TEST_Deletable__',
    description: 'Will be deleted',
    allowedUomTypes: ['count'],
  });
  testContainerType2Id = create2.data?._id || create2.data?.id || '';

  // ── 4. GET /container-types/:id ──
  console.log('\n4. GET /inventory/container-types/:id');
  const getRes = await api('GET', `/inventory/container-types/${testContainerTypeId}`);
  assert(getRes.status === 200, `Status 200 (got ${getRes.status})`);
  assert(getRes.data?.name === '__TEST_Ampoule__', `Name: __TEST_Ampoule__`);

  // ── 5. PUT /container-types/:id — update ──
  console.log('\n5. PUT /inventory/container-types/:id — update');
  const updateRes = await api('PUT', `/inventory/container-types/${testContainerTypeId}`, {
    description: 'Updated description',
    allowedUomTypes: ['volume', 'weight'],
  });
  assert(updateRes.status === 200, `Status 200 (got ${updateRes.status})`);
  assert(updateRes.data?.description === 'Updated description', 'Description updated');
  const updatedTypes = updateRes.data?.allowedUomTypes || [];
  assert(updatedTypes.includes('volume') && updatedTypes.includes('weight'), `allowedUomTypes = [volume, weight]`);

  // ── 6. POST validation — missing allowedUomTypes ──
  console.log('\n6. POST /inventory/container-types — validation (missing allowedUomTypes)');
  const noUom = await api('POST', '/inventory/container-types', {
    name: '__TEST_Invalid__',
  });
  assert(noUom.status === 400, `Status 400 (got ${noUom.status})`);

  // ── 7. POST validation — empty allowedUomTypes ──
  console.log('\n7. POST /inventory/container-types — validation (empty allowedUomTypes)');
  const emptyUom = await api('POST', '/inventory/container-types', {
    name: '__TEST_Invalid2__',
    allowedUomTypes: [],
  });
  assert(emptyUom.status === 400, `Status 400 (got ${emptyUom.status})`);

  // ── 8. POST validation — duplicate name ──
  console.log('\n8. POST /inventory/container-types — duplicate name');
  const dup = await api('POST', '/inventory/container-types', {
    name: '__TEST_Ampoule__',
    allowedUomTypes: ['count'],
  });
  assert(dup.status === 409 || dup.status === 400, `Status 409 or 400 (got ${dup.status})`);

  // ── 9. POST /products — create with containerType ──
  console.log('\n9. POST /inventory/products — create product with containerType');
  if (existingCategoryId && existingUnitId) {
    const prodRes = await api('POST', '/inventory/products', {
      name: '__TEST_Product_CT__',
      category: existingCategoryId,
      containerType: testContainerTypeId,
      unitOfMeasurement: existingUnitId,
      currentStock: 10,
      reorderPoint: 5,
      sellingPrice: 99,
      status: 'active',
    });
    assert(prodRes.status === 201, `Status 201 (got ${prodRes.status})`);
    testProductId = prodRes.data?._id || '';
    assert(!!testProductId, `Created product: ${testProductId}`);

    // Check containerType is populated
    const ctField = prodRes.data?.containerType;
    assert(!!ctField, 'containerType field present in response');
    if (ctField && typeof ctField === 'object') {
      assert(ctField.name === '__TEST_Ampoule__', `containerType populated: "${ctField.name}"`);
      assert(Array.isArray(ctField.allowedUomTypes), 'containerType has allowedUomTypes');
    }
  } else {
    console.log('  ⏭️  Skipped — no category/unit available');
  }

  // ── 10. GET /products/:id — verify containerType populated ──
  console.log('\n10. GET /inventory/products/:id — verify containerType');
  if (testProductId) {
    const getProduct = await api('GET', `/inventory/products/${testProductId}`);
    assert(getProduct.status === 200, `Status 200 (got ${getProduct.status})`);
    const ct = getProduct.data?.containerType;
    assert(!!ct && typeof ct === 'object', 'containerType is populated object');
    assert(ct?.name === '__TEST_Ampoule__', `containerType.name = "__TEST_Ampoule__"`);
    assert(Array.isArray(ct?.allowedUomTypes), 'containerType.allowedUomTypes is array');
  } else {
    console.log('  ⏭️  Skipped — no test product');
  }

  // ── 11. PUT /products/:id — update containerType ──
  console.log('\n11. PUT /inventory/products/:id — update containerType');
  if (testProductId && testContainerType2Id) {
    const updProd = await api('PUT', `/inventory/products/${testProductId}`, {
      containerType: testContainerType2Id,
    });
    assert(updProd.status === 200, `Status 200 (got ${updProd.status})`);
    const newCt = updProd.data?.containerType;
    assert(newCt?.name === '__TEST_Deletable__', `containerType updated to "__TEST_Deletable__"`);
  } else {
    console.log('  ⏭️  Skipped');
  }

  // ── 12. DELETE /container-types/:id — should fail (product linked) ──
  console.log('\n12. DELETE /inventory/container-types/:id — fail (product linked)');
  if (testContainerType2Id && testProductId) {
    const delFail = await api('DELETE', `/inventory/container-types/${testContainerType2Id}`);
    assert(delFail.status === 400, `Status 400 (got ${delFail.status})`);
    assert(delFail.data?.error?.includes('Cannot delete') || delFail.data?.message?.includes('Cannot delete'),
      'Error mentions products using it');
  } else {
    console.log('  ⏭️  Skipped');
  }

  // ── 13. DELETE unused container type ──
  console.log('\n13. DELETE /inventory/container-types/:id — delete unused');
  // First move product back to first container type so second is unused
  if (testProductId && testContainerTypeId) {
    await api('PUT', `/inventory/products/${testProductId}`, {
      containerType: testContainerTypeId,
    });
  }
  if (testContainerType2Id) {
    const delOk = await api('DELETE', `/inventory/container-types/${testContainerType2Id}`);
    assert(delOk.status === 200, `Status 200 (got ${delOk.status})`);
  }

  // ── Cleanup ──
  console.log('\n🧹 Cleanup');
  if (testProductId) {
    const delProd = await api('DELETE', `/inventory/products/${testProductId}`);
    assert(delProd.status === 200, `Deleted test product (${delProd.status})`);
  }
  if (testContainerTypeId) {
    const delCt = await api('DELETE', `/inventory/container-types/${testContainerTypeId}`);
    assert(delCt.status === 200, `Deleted test container type (${delCt.status})`);
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
