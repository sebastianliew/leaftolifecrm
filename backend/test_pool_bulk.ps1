# Debug pool and bulk-delete endpoints
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }

$catJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/categories" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$catId = $catJson.categories[0]._id
$unitJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/units" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$unitId = $unitJson[0]._id

# Create a fresh test product
$prodBody = "{""name"":""TEST_POOL_DEBUG"",""sku"":""TEST-POOL-DEBUG-001"",""type"":""product"",""price"":10,""costPrice"":5,""stock"":50,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true}"
$newProd = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
$prodId = $newProd._id
Write-Host "Created product: $prodId" -ForegroundColor Yellow
Write-Host "Full product JSON: $($newProd | ConvertTo-Json -Depth 2)" -ForegroundColor Gray

# Test pool endpoint - look at products route definition first
Write-Host ""
Write-Host "=== Testing pool endpoint ===" -ForegroundColor Cyan
$poolBodies = @(
    '{"quantity":10}',
    '{"quantity":10,"location":"Warehouse A"}',
    '{"quantity":10,"type":"add"}',
    '{"stockAdded":10}',
    '{"amount":10}'
)

foreach ($body in $poolBodies) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId/pool" -Method POST -Headers $H -Body $body -ContentType "application/json" -UseBasicParsing
        Write-Host "PASS with body: $body -> $($resp.StatusCode)" -ForegroundColor Green
        Write-Host "Response: $($resp.Content)" -ForegroundColor White
        break
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errStream = $_.Exception.Response.GetResponseStream()
        $sr = [System.IO.StreamReader]::new($errStream)
        $errBody = $sr.ReadToEnd()
        Write-Host "FAIL ($code) with body: $body | Error: $errBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Testing bulk-delete ===" -ForegroundColor Cyan
$bulkBodies = @(
    "{""ids"":[""$prodId""]}",
    "{""productIds"":[""$prodId""]}",
    "[""$prodId""]",
    "{""ids"":[""$prodId""],""permanent"":true}"
)

foreach ($body in $bulkBodies) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/bulk-delete" -Method POST -Headers $H -Body $body -ContentType "application/json" -UseBasicParsing
        Write-Host "PASS with body: $body -> $($resp.StatusCode)" -ForegroundColor Green
        Write-Host "Response: $($resp.Content)" -ForegroundColor White
        break
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
Write-Host "Cleaning up test product..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Method DELETE -Headers $H -UseBasicParsing | Out-Null
    Write-Host "Cleaned up OK" -ForegroundColor Gray
} catch {}
