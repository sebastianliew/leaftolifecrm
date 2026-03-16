# Debug pool endpoint - check existing product
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}' -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }

Write-Host "=== Checking existing product for pool test ===" -ForegroundColor Cyan
$prodList = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
$prodId = $prodList.products[0]._id
$prodName = $prodList.products[0].name

Write-Host "Product ID: $prodId"
Write-Host "Product Name: $prodName"

$prodDetail = (Invoke-WebRequest -Uri "http://localhost:5001/api/inventory/products/$prodId" -Headers $H -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "canSellLoose: $($prodDetail.canSellLoose)"
Write-Host "currentStock: $($prodDetail.currentStock)"
Write-Host "looseStock: $($prodDetail.looseStock)"
Write-Host "containerCapacity: $($prodDetail.containerCapacity)"

Write-Host ""
Write-Host "=== Testing pool with action=open ===" -ForegroundColor Cyan
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
