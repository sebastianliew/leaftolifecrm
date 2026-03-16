# Test product creation, CRUD, and bulk-delete with correct field names
Write-Host "=== Testing Remaining Product Endpoints ===" -ForegroundColor Cyan

# Auth
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }
Write-Host "Auth OK" -ForegroundColor Green

# Get a real category ID and unit ID
$catJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/categories" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$catId = $catJson.categories[0]._id
Write-Host "Category ID: $catId ($($catJson.categories[0].name))" -ForegroundColor Yellow

$unitJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/units" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$unitId = $unitJson[0]._id
Write-Host "Unit ID: $unitId ($($unitJson[0].name))" -ForegroundColor Yellow

# Get a real product ID from existing products
$prodList = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$existingProdId = $prodList.products[0]._id
Write-Host "Existing Product ID: $existingProdId ($($prodList.products[0].name))" -ForegroundColor Yellow

Write-Host ""

# 1. GET /inventory/products/:id (with real ID)
Write-Host "1. GET /inventory/products/:id" -ForegroundColor White
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$existingProdId" -Headers $H -UseBasicParsing
    Write-Host "   PASS -> $($resp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   FAIL -> $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

# 2. POST /inventory/products (correct fields: category + unitOfMeasurement)
Write-Host "2. POST /inventory/products" -ForegroundColor White
$prodBody = "{""name"":""TEST_PROD_FINAL"",""sku"":""TEST-FINAL-001"",""type"":""product"",""price"":10,""costPrice"":5,""stock"":50,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
$newProdId = $null
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody -ContentType "application/json" -UseBasicParsing
    $newProdId = ($resp.Content | ConvertFrom-Json)._id
    Write-Host "   PASS -> $($resp.StatusCode) | ID: $newProdId" -ForegroundColor Green
} catch {
    Write-Host "   FAIL -> $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    Write-Host "   Error: $($sr.ReadToEnd())" -ForegroundColor Yellow
}

# 3. PUT /inventory/products/:id
Write-Host "3. PUT /inventory/products/:id" -ForegroundColor White
if ($newProdId) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$newProdId" -Method PUT -Headers $H -Body '{"name":"TEST_PROD_UPDATED","price":15}' -ContentType "application/json" -UseBasicParsing
        Write-Host "   PASS -> $($resp.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "   FAIL -> $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
} else { Write-Host "   SKIP (no product created)" -ForegroundColor Gray }

# 4. POST /inventory/products/:id/pool
Write-Host "4. POST /inventory/products/:id/pool" -ForegroundColor White
if ($newProdId) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$newProdId/pool" -Method POST -Headers $H -Body '{"quantity":10}' -ContentType "application/json" -UseBasicParsing
        Write-Host "   PASS -> $($resp.StatusCode)" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errStream = $_.Exception.Response.GetResponseStream()
        $sr = [System.IO.StreamReader]::new($errStream)
        Write-Host "   FAIL -> $code | $($sr.ReadToEnd())" -ForegroundColor Red
    }
} else { Write-Host "   SKIP (no product created)" -ForegroundColor Gray }

# 5. DELETE /inventory/products/:id
Write-Host "5. DELETE /inventory/products/:id" -ForegroundColor White
if ($newProdId) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$newProdId" -Method DELETE -Headers $H -UseBasicParsing
        Write-Host "   PASS -> $($resp.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "   FAIL -> $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
} else { Write-Host "   SKIP (no product created)" -ForegroundColor Gray }

# 6. POST /inventory/products/bulk-delete (with real existing product ID)
Write-Host "6. POST /inventory/products/bulk-delete" -ForegroundColor White

# Create a throwaway product first so we don't delete real data
$throwBody = "{""name"":""TEST_BULK_DELETE"",""sku"":""TEST-BULK-001"",""type"":""product"",""price"":1,""costPrice"":1,""stock"":1,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
try {
    $throwResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $throwBody -ContentType "application/json" -UseBasicParsing
    $throwId = ($throwResp.Content | ConvertFrom-Json)._id
    Write-Host "   Created throwaway product: $throwId" -ForegroundColor Yellow

    $bulkBody = "{""ids"":[""$throwId""]}"
    $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/bulk-delete" -Method POST -Headers $H -Body $bulkBody -ContentType "application/json" -UseBasicParsing
    Write-Host "   PASS -> $($resp.StatusCode) | $($resp.Content)" -ForegroundColor Green
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    Write-Host "   FAIL -> $code | $($sr.ReadToEnd())" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
