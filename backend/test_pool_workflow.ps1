# Test pool workflow: create product -> update canSellLoose -> test pool
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }

Write-Host "=== Step 1: Create product with stock ===" -ForegroundColor Cyan
$catJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/categories" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$catId = $catJson.categories[0]._id
$unitJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/units" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$unitId = $unitJson[0]._id

$ts = Get-Date -Format "yyyyMMddHHmmss"
$prodBody = "{""name"":""TEST_POOL_WORKFLOW_$ts"",""sku"":""TPW-$ts"",""type"":""product"",""costPrice"":5,""currentStock"":100,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true,""containerCapacity"":10}"
$newProd = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
$prodId = $newProd._id
Write-Host "Created: $prodId" -ForegroundColor Green
Write-Host "canSellLoose (initial): $($newProd.canSellLoose)"

Write-Host ""
Write-Host "=== Step 2: Update product to enable canSellLoose ===" -ForegroundColor Cyan
$updateBody = "{""canSellLoose"":true}"
try {
    $updateResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Method PUT -Headers $H -Body $updateBody -ContentType "application/json" -UseBasicParsing
    Write-Host "Update successful: $($updateResp.StatusCode)" -ForegroundColor Green
    $updatedProd = $updateResp.Content | ConvertFrom-Json
    Write-Host "canSellLoose (after update): $($updatedProd.canSellLoose)"
} catch {
    Write-Host "Update failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Step 3: Test pool open ===" -ForegroundColor Cyan
try {
    $poolResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId/pool" -Method POST -Headers $H -Body '{"action":"open","bottleCount":2}' -ContentType "application/json" -UseBasicParsing
    Write-Host "Pool open SUCCESS: $($poolResp.StatusCode)" -ForegroundColor Green
    Write-Host $poolResp.Content
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    $errBody = $sr.ReadToEnd()
    Write-Host "Pool open FAIL: $code" -ForegroundColor Red
    Write-Host "Error: $errBody" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Step 4: Test pool close ===" -ForegroundColor Cyan
try {
    $poolCloseResp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId/pool" -Method POST -Headers $H -Body '{"action":"close","bottleCount":1}' -ContentType "application/json" -UseBasicParsing
    Write-Host "Pool close SUCCESS: $($poolCloseResp.StatusCode)" -ForegroundColor Green
    Write-Host $poolCloseResp.Content
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    $errBody = $sr.ReadToEnd()
    Write-Host "Pool close FAIL: $code" -ForegroundColor Red
    Write-Host "Error: $errBody" -ForegroundColor Yellow
}

# Clean up
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Method DELETE -Headers $H -UseBasicParsing | Out-Null
    Write-Host "Cleaned up OK" -ForegroundColor Gray
} catch {}

Write-Host ""
Write-Host "=== Pool workflow test complete ===" -ForegroundColor Cyan
