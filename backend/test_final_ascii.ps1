# LeafToLife Inventory API - FINAL CORRECTED Test Suite
$PASS = 0; $FAIL = 0; $SKIP = 0
$results = @()

function Test-Endpoint {
    param($name, $method, $url, $body, $headers, [int]$expectedCode = 200)
    try {
        $params = @{ Uri=$url; Method=$method; Headers=$headers; UseBasicParsing=$true }
        if ($body) { $params.Body = $body; $params.ContentType = "application/json" }
        $resp = Invoke-WebRequest @params
        $code = [int]$resp.StatusCode
        $ok = ($code -eq $expectedCode) -or ($expectedCode -eq 200 -and $code -ge 200 -and $code -lt 300)
        if ($ok) {
            $script:PASS++
            $script:results += [PSCustomObject]@{ Test=$name; Status="PASS"; Code=$code }
            Write-Host "  [PASS] $code $name" -ForegroundColor Green
            return $resp
        } else {
            $script:FAIL++
            $script:results += [PSCustomObject]@{ Test=$name; Status="FAIL"; Code=$code }
            Write-Host "  [FAIL] $code $name" -ForegroundColor Red
            return $null
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errStream = $_.Exception.Response.GetResponseStream()
        $errBody = ""
        if ($errStream) { $sr = [System.IO.StreamReader]::new($errStream); $errBody = $sr.ReadToEnd() }
        $script:FAIL++
        $script:results += [PSCustomObject]@{ Test=$name; Status="FAIL"; Code=$code; Error=$errBody }
        Write-Host "  [FAIL] $code $name | $errBody" -ForegroundColor Red
        return $null
    }
}

function Skip-Endpoint($name) {
    $script:SKIP++
    $script:results += [PSCustomObject]@{ Test=$name; Status="SKIP"; Code="-" }
    Write-Host "  [SKIP] $name" -ForegroundColor Gray
}

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host " LEAFTOLIFE INVENTORY API - FINAL TEST" -ForegroundColor Cyan
Write-Host " $(Get-Date)" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

# AUTH
Write-Host "`n[AUTH]" -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type"="application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization="Bearer $TOKEN" }
Write-Host "  Token OK" -ForegroundColor Green

$ts = Get-Date -Format "HHmmss"

# UNITS
Write-Host "`n[UNITS]" -ForegroundColor Yellow
$unitsResp = Test-Endpoint "GET /inventory/units" GET "http://localhost:5001/api/inventory/units" $null $H
$unitId = ($unitsResp.Content | ConvertFrom-Json)[0]._id

$newUnitResp = Test-Endpoint "POST /inventory/units" POST "http://localhost:5001/api/inventory/units" "{""name"":""TEST_$ts"",""abbreviation"":""t$ts"",""type"":""count""}" $H 201
$testUnitId = if ($newUnitResp) { ($newUnitResp.Content | ConvertFrom-Json)._id } else { $null }

Test-Endpoint "GET /inventory/units/:id" GET "http://localhost:5001/api/inventory/units/$unitId" $null $H | Out-Null
Test-Endpoint "PUT /inventory/units/:id" PUT "http://localhost:5001/api/inventory/units/$unitId" '{"description":"Updated"}' $H | Out-Null

if ($testUnitId) { Test-Endpoint "DELETE /inventory/units/:id" DELETE "http://localhost:5001/api/inventory/units/$testUnitId" $null $H | Out-Null }
else { Skip-Endpoint "DELETE /inventory/units/:id" }

# CATEGORIES
Write-Host "`n[CATEGORIES]" -ForegroundColor Yellow
$catsResp = Test-Endpoint "GET /inventory/categories" GET "http://localhost:5001/api/inventory/categories" $null $H
$catId = ($catsResp.Content | ConvertFrom-Json).categories[0]._id

$newCatResp = Test-Endpoint "POST /inventory/categories" POST "http://localhost:5001/api/inventory/categories" "{""name"":""TEST_$ts"",""description"":""Test""}" $H 201
$testCatId = if ($newCatResp) { ($newCatResp.Content | ConvertFrom-Json)._id } else { $null }

Test-Endpoint "GET /inventory/categories/:id" GET "http://localhost:5001/api/inventory/categories/$catId" $null $H | Out-Null
Test-Endpoint "PUT /inventory/categories/:id" PUT "http://localhost:5001/api/inventory/categories/$catId" '{"description":"Updated"}' $H | Out-Null

if ($testCatId) { Test-Endpoint "DELETE /inventory/categories/:id" DELETE "http://localhost:5001/api/inventory/categories/$testCatId" $null $H | Out-Null }
else { Skip-Endpoint "DELETE /inventory/categories/:id" }

# PRODUCTS
Write-Host "`n[PRODUCTS]" -ForegroundColor Yellow
$prodsResp = Test-Endpoint "GET /inventory/products" GET "http://localhost:5001/api/inventory/products" $null $H
$existingProdId = ($prodsResp.Content | ConvertFrom-Json).products[0]._id

Test-Endpoint "GET /inventory/products/stats" GET "http://localhost:5001/api/inventory/products/stats" $null $H | Out-Null
Test-Endpoint "GET /inventory/products/export" GET "http://localhost:5001/api/inventory/products/export" $null $H | Out-Null
Test-Endpoint "GET /inventory/products/:id" GET "http://localhost:5001/api/inventory/products/$existingProdId" $null $H | Out-Null

$prodBody = "{""name"":""TEST_$ts"",""sku"":""TST-$ts"",""type"":""product"",""costPrice"":5,""currentStock"":100,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
$newProdResp = Test-Endpoint "POST /inventory/products" POST "http://localhost:5001/api/inventory/products" $prodBody $H 201
$testProdId = if ($newProdResp) { ($newProdResp.Content | ConvertFrom-Json)._id } else { $null }

if ($testProdId) {
    Test-Endpoint "PUT /inventory/products/:id" PUT "http://localhost:5001/api/inventory/products/$testProdId" '{"name":"TEST_UPDATED"}' $H | Out-Null
    Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$testProdId" -Method PUT -Headers $H -Body '{"canSellLoose":true}' -ContentType "application/json" -UseBasicParsing | Out-Null
    Test-Endpoint "POST /inventory/products/:id/pool" POST "http://localhost:5001/api/inventory/products/$testProdId/pool" '{"action":"open","bottleCount":2}' $H | Out-Null
    Test-Endpoint "DELETE /inventory/products/:id" DELETE "http://localhost:5001/api/inventory/products/$testProdId" $null $H | Out-Null
} else {
    Skip-Endpoint "PUT /inventory/products/:id"
    Skip-Endpoint "POST /inventory/products/:id/pool"
    Skip-Endpoint "DELETE /inventory/products/:id"
}

$throwBody = "{""name"":""THROW_$ts"",""sku"":""THR-$ts"",""type"":""product"",""costPrice"":1,""currentStock"":1,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
try {
    $throwResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $throwBody -ContentType "application/json" -UseBasicParsing
    $throwId = ($throwResp.Content | ConvertFrom-Json)._id
    Test-Endpoint "POST /inventory/products/bulk-delete" POST "http://localhost:5001/api/inventory/products/bulk-delete" "{""productIds"":[""$throwId""]}" $H | Out-Null
} catch { Skip-Endpoint "POST /inventory/products/bulk-delete" }

# RESTOCK
Write-Host "`n[RESTOCK]" -ForegroundColor Yellow
Test-Endpoint "GET /inventory/restock/suggestions" GET "http://localhost:5001/api/inventory/restock/suggestions" $null $H | Out-Null
Test-Endpoint "GET /inventory/restock" GET "http://localhost:5001/api/inventory/restock" $null $H | Out-Null
Test-Endpoint "GET /inventory/restock/batches" GET "http://localhost:5001/api/inventory/restock/batches" $null $H | Out-Null

$restockBody = "{""productId"":""$existingProdId"",""quantity"":10,""notes"":""API test""}"
Test-Endpoint "POST /inventory/restock" POST "http://localhost:5001/api/inventory/restock" $restockBody $H 201

$bulkRestockBody = "{""operations"":[{""productId"":""$existingProdId"",""quantity"":5,""notes"":""Bulk""}]}"
Test-Endpoint "POST /inventory/restock/bulk" POST "http://localhost:5001/api/inventory/restock/bulk" $bulkRestockBody $H | Out-Null

# SUMMARY
Write-Host "`n=============================================================" -ForegroundColor Cyan
Write-Host " RESULTS: PASS=$PASS FAIL=$FAIL SKIP=$SKIP TOTAL=$($PASS+$FAIL+$SKIP)" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

if ($FAIL -gt 0) {
    Write-Host "`nFailed:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object { Write-Host "  $($_.Test) [$($_.Code)] $($_.Error)" -ForegroundColor Red }
}
if ($SKIP -gt 0) {
    Write-Host "`nSkipped:" -ForegroundColor Gray
    $results | Where-Object { $_.Status -eq "SKIP" } | ForEach-Object { Write-Host "  $($_.Test)" -ForegroundColor Gray }
}
