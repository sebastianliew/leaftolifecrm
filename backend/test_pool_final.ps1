# Test pool endpoint with correct payload
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }

$catJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/categories" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$catId = $catJson.categories[0]._id
$unitJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/units" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$unitId = $unitJson[0]._id

Write-Host "=== Testing pool endpoint ===" -ForegroundColor Cyan

# First, create a product with canSellLoose: true
$prodBody = "{""name"":""TEST_LOOSE_PRODUCT"",""sku"":""TEST-LOOSE-001"",""type"":""product"",""price"":10,""costPrice"":5,""stock"":50,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true,""canSellLoose"":true}"
Write-Host "Creating product with canSellLoose: true" -ForegroundColor Yellow
$newProd = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
$prodId = $newProd._id
Write-Host "Created product: $prodId" -ForegroundColor Green

# Test pool with correct payload
$poolBodies = @(
    '{"action":"open","bottleCount":5}',
    '{"action":"close","bottleCount":2}'
)

foreach ($body in $poolBodies) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId/pool" -Method POST -Headers $H -Body $body -ContentType "application/json" -UseBasicParsing
        Write-Host "PASS with body: $body -> $($resp.StatusCode)" -ForegroundColor Green
        Write-Host "Response: $($resp.Content)" -ForegroundColor White
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errStream = $_.Exception.Response.GetResponseStream()
        $sr = [System.IO.StreamReader]::new($errStream)
        $errBody = $sr.ReadToEnd()
        Write-Host "FAIL ($code) with body: $body | Error: $errBody" -ForegroundColor Red
    }
}

# Clean up
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Method DELETE -Headers $H -UseBasicParsing | Out-Null
    Write-Host "Cleaned up OK" -ForegroundColor Gray
} catch {}

Write-Host ""
Write-Host "=== Testing bulk-delete with productIds ===" -ForegroundColor Cyan

# Create another test product
$prodBody2 = "{""name"":""TEST_BULK_FINAL"",""sku"":""TEST-BULK-FINAL-001"",""type"":""product"",""price"":1,""costPrice"":1,""stock"":1,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
$throwProd = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody2 -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
$throwId = $throwProd._id
Write-Host "Created throwaway product: $throwId" -ForegroundColor Yellow

# Test bulk-delete with correct field name (productIds, not ids)
$bulkBody = "{""productIds"":[""$throwId""]}"
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/bulk-delete" -Method POST -Headers $H -Body $bulkBody -ContentType "application/json" -UseBasicParsing
    Write-Host "PASS with body: $bulkBody -> $($resp.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($resp.Content)" -ForegroundColor White
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    $errBody = $sr.ReadToEnd()
    Write-Host "FAIL ($code) with body: $bulkBody | Error: $errBody" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== All tests complete ===" -ForegroundColor Cyan
