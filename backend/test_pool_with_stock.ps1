# Test pool with a product that has canSellLoose=true AND existing stock
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }

Write-Host "=== Creating product with canSellLoose + stock ===" -ForegroundColor Cyan
$catJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/categories" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$catId = $catJson.categories[0]._id
$unitJson = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/units" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$unitId = $unitJson[0]._id

$ts = Get-Date -Format "yyyyMMddHHmmss"
$prodBody = "{""name"":""TEST_LOOSE_$ts"",""sku"":""TL-$ts"",""type"":""product"",""costPrice"":5,""currentStock"":100,""category"":""$catId"",""unitOfMeasurement"":""$unitId"",""isActive"":true,""canSellLoose"":true,""containerCapacity"":10}"
Write-Host "Creating with: currentStock=100, canSellLoose=true, containerCapacity=10" -ForegroundColor Yellow

$newProd = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Method POST -Headers $H -Body $prodBody -ContentType "application/json" -UseBasicParsing).Content | ConvertFrom-Json
$prodId = $newProd._id
Write-Host "Created product: $prodId" -ForegroundColor Green

# Verify the product was created correctly
Write-Host ""
Write-Host "=== Verifying product ===" -ForegroundColor Cyan
$prodDetail = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "canSellLoose: $($prodDetail.canSellLoose)"
Write-Host "currentStock: $($prodDetail.currentStock)"
Write-Host "looseStock: $($prodDetail.looseStock)"
Write-Host "containerCapacity: $($prodDetail.containerCapacity)"

# Calculate sealed stock
$sealed = $prodDetail.currentStock - (if ($prodDetail.PSObject.Properties.Name -contains "looseStock" -and $prodDetail.looseStock) { $prodDetail.looseStock } else { 0 })
Write-Host "Sealed stock (calculated): $sealed"
Write-Host "Sealed bottles available: $([math]::Floor($sealed / 10))"

Write-Host ""
Write-Host "=== Testing pool open (should work - 100 stock, 10 capacity = 10 bottles) ===" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId/pool" -Method POST -Headers $H -Body '{"action":"open","bottleCount":1}' -ContentType "application/json" -UseBasicParsing
    Write-Host "SUCCESS -> $($resp.StatusCode)" -ForegroundColor Green
    Write-Host $resp.Content
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $errStream = $_.Exception.Response.GetResponseStream()
    $sr = [System.IO.StreamReader]::new($errStream)
    $errBody = $sr.ReadToEnd()
    Write-Host "FAIL -> $code" -ForegroundColor Red
    Write-Host "Error: $errBody" -ForegroundColor Yellow
}

# Clean up
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Method DELETE -Headers $H -UseBasicParsing | Out-Null
    Write-Host "Cleaned up OK" -ForegroundColor Gray
} catch {}
