# LeafToLife Inventory API - Final Complete Test
# All 25 endpoints with correct payloads

$PASS = 0; $FAIL = 0; $SKIP = 0
$results = @()

function Test-Endpoint {
    param($name, $method, $url, $body, $headers, $expectedCode = 200)
    try {
        $params = @{
            Uri = $url
            Method = $method
            Headers = $headers
            UseBasicParsing = $true
        }
        if ($body) {
            $params.Body = $body
            $params.ContentType = "application/json"
        }
        $resp = Invoke-WebRequest @params
        $code = $resp.StatusCode
        if ($code -eq $expectedCode -or ($expectedCode -eq 200 -and $code -ge 200 -and $code -lt 300)) {
            $script:PASS++
            $results += [PSCustomObject]@{ Test=$name; Status="PASS"; Code=$code }
            Write-Host "  PASS [$code] $name" -ForegroundColor Green
            return $resp
        } else {
            $script:FAIL++
            $results += [PSCustomObject]@{ Test=$name; Status="FAIL"; Code=$code }
            Write-Host "  FAIL [$code] $name" -ForegroundColor Red
            return $null
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errStream = $_.Exception.Response.GetResponseStream()
        $errBody = ""
        if ($errStream) {
            $sr = [System.IO.StreamReader]::new($errStream)
            $errBody = $sr.ReadToEnd()
        }
        $script:FAIL++
        $results += [PSCustomObject]@{ Test=$name; Status="FAIL"; Code=$code; Error=$errBody }
        Write-Host "  FAIL [$code] $name | $errBody" -ForegroundColor Red
        return $null
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " LEAFTOLIFE INVENTORY API - FINAL TEST SUITE" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# --- AUTH ---
Write-Host "`n[AUTH]" -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }
Write-Host "  Token acquired OK" -ForegroundColor Green

# --- UNITS ---
Write-Host "`n[UNITS]" -ForegroundColor Yellow
$unitsResp = Test-Endpoint "GET /inventory/units" GET "http://localhost:5001/api/inventory/units" $null $H
$unitId = ($unitsResp.Content | ConvertFrom-Json)[0]._id
Write-Host "  Using unit: $unitId"

$ts = Get-Date -Format "yyyyMMddHHmmss"
$createUnitResp = Test-Endpoint "POST /inventory/units" POST "http://localhost:5001/api/inventory/units" "{""name"":""TEST_UNIT_$ts"",""abbreviation"":""tu$ts"",""type"":""count""}" $H 201
$testUnitId = $null
if ($createUnitResp) { $testUnitId = ($createUnitResp.Content | ConvertFrom-Json)._id }

Test-Endpoint "GET /inventory/units/:id" GET "http://localhost:5001/api/inventory/units/$unitId" $null $H | Out-Null
Test-Endpoint "PUT /inventory/units/:id" PUT "http://localhost:5001/api/inventory/units/$unitId" '{"description":"Updated by test"}' $H | Out-Null

if ($testUnitId) {
    Test-Endpoint "DELETE /inventory/units/:id" DELETE "http://localhost:5001/api/inventory/units/$testUnitId" $null $H | Out-Null
} else { $SKIP++; Write-Host "  SKIP DELETE /inventory/units/:id" -ForegroundColor Gray }

# --- CATEGORIES ---
Write-Host "`n[CATEGORIES]" -ForegroundColor Yellow
$catsResp = Test-Endpoint "GET /inventory/categories" GET "http://localhost:5001/api/inventory/categories" $null $H
$catId = ($catsResp.Content | ConvertFrom-Json).categories[0]._id
Write-Host "  Using category: $catId"

$createCatResp = Test-Endpoint "POST /inventory/categories" POST "http://localhost:5001/api/inventory/categories" "{""name"":""TEST_CAT_$ts"",""description"":""Test category""}" $H 201
$testCatId = $null
if ($createCatResp) { $testCatId = ($createCatResp.Content | ConvertFrom-Json)._id }

Test-Endpoint "GET /inventory/categories/:id" GET "http://localhost:5001/api/inventory/categories/$catId" $null $H | Out-Null
Test-Endpoint "PUT /inventory/categories/:id" PUT "http://localhost:5001/api/inventory/categories/$catId" '{"description":"Updated by test"}' $H | Out-Null

if ($testCatId) {
    Test-Endpoint "DELETE /inventory/categories/:id" DELETE "http://localhost:5001/api/inventory/categories/$testCatId" $null $H | Out-Null
} else { $SKIP++; Write-Host "  SKIP DELETE /inventory/categories/:id" -ForegroundColor Gray }

# --- PRODUCTS ---
Write-Host "`n[PRODUCTS]" -ForegroundColor Yellow
$prodsResp = Test-Endpoint "GET /inventory/products" GET "http://localhost:5001/api/inventory/products" $null $H
$existingProdId = ($prodsResp.Content | ConvertFrom-Json).products[0]._id
Write-Host "  Using existing product: $existingProdId"

Test-Endpoint "GET /inventory/products/stats" GET "http://localhost:5001/api/inventory/products/stats" $null $H | Out-Null
Test-Endpoint "GET /inventory/products/export" GET "http://localhost:5001/api/inventory/products/export" $null $H | Out-Null
Test-Endpoint "GET /inventory/products/:id" GET "http://localhost:5001/api/inventory/products/$existingProdId" $null $H | Out-Null

# Create product with currentStock + canSellLoose for pool test
$prodBody = "{""name"":""TEST_PROD_FINAL_$ts"",""sku"":""TPF-$ts"",""type"":""product"",""costPrice"":5,""currentStock"":100,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true,""canSellLoose"":true,""containerCapacity"":10}"
$createProdResp = Test-Endpoint "POST /inventory/products" POST "http://localhost:5001/api/inventory/products" $prodBody $H 201
$testProdId = $null
if ($createProdResp) { $testProdId = ($createProdResp.Content | ConvertFrom-Json)._id }
Write-Host "  Created test product: $testProdId"

if ($testProdId) {
    Test-Endpoint "PUT /inventory/products/:id" PUT "http://localhost:5001/api/inventory/products/$testProdId" '{"name":"TEST_PROD_UPDATED"}' $H | Out-Null
    
    # Pool - action=open, bottleCount=2 (product has 100 stock, capacity 10, so 10 sealed bottles available)
    Test-Endpoint "POST /inventory/products/:id/pool" POST "http://localhost:5001/api/inventory/products/$testProdId/pool" '{"action":"open","bottleCount":2}' $H | Out-Null
    
    # Bulk-delete throwaway product
    $throwBody = "{""name"":""THROW_$ts"",""sku"":""THROW-$ts"",""type"":""product"",""costPrice"":1,""currentStock"":1,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
    $throwResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $throwBody -ContentType "application/json" -UseBasicParsing
    $throwId = ($throwResp.Content | ConvertFrom-Json)._id
    Write-Host "  Throwaway product for bulk-delete: $throwId"
    Test-Endpoint "POST /inventory/products/bulk-delete" POST "http://localhost:5001/api/inventory/products/bulk-delete" "{""productIds"":[""$throwId""]}" $H | Out-Null
    
    # Delete test product
    Test-Endpoint "DELETE /inventory/products/:id" DELETE "http://localhost:5001/api/inventory/products/$testProdId" $null $H | Out-Null
} else {
    $SKIP += 5
    Write-Host "  SKIP PUT/pool/bulk-delete/DELETE (no test product)" -ForegroundColor Gray
}

# --- RESTOCK ---
Write-Host "`n[RESTOCK]" -ForegroundColor Yellow
Test-Endpoint "GET /inventory/restock/suggestions" GET "http://localhost:5001/api/inventory/restock/suggestions" $null $H | Out-Null
Test-Endpoint "GET /inventory/restock/history" GET "http://localhost:5001/api/inventory/restock/history" $null $H | Out-Null

# Create a restock order for existing product
$restockBody = "{""productId"":""$existingProdId"",""quantity"":10,""supplier"":""Test Supplier"",""notes"":""API test""}"
$restockResp = Test-Endpoint "POST /inventory/restock" POST "http://localhost:5001/api/inventory/restock" $restockBody $H 201
$restockId = $null
if ($restockResp) { $restockId = ($restockResp.Content | ConvertFrom-Json)._id }

if ($restockId) {
    Test-Endpoint "GET /inventory/restock/:id" GET "http://localhost:5001/api/inventory/restock/$restockId" $null $H | Out-Null
    Test-Endpoint "PUT /inventory/restock/:id" PUT "http://localhost:5001/api/inventory/restock/$restockId" '{"notes":"Updated by test"}' $H | Out-Null
} else { $SKIP += 2; Write-Host "  SKIP GET/PUT restock/:id" -ForegroundColor Gray }

# Bulk restock - correct payload uses 'operations' array
$bulkRestockBody = "{""operations"":[{""productId"":""$existingProdId"",""quantity"":5,""notes"":""Bulk test""}]}"
Test-Endpoint "POST /inventory/restock/bulk" POST "http://localhost:5001/api/inventory/restock/bulk" $bulkRestockBody $H | Out-Null

# Summary
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " RESULTS: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP  TOTAL=$($PASS+$FAIL+$SKIP)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if ($FAIL -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  - $($_.Test) [$($_.Code)] $($_.Error)" -ForegroundColor Red
    }
}
