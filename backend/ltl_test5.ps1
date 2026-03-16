$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJ1c2VySWQiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJlbWFpbCI6InN1cGVyYWRtaW5AbGVhZnRvbGlmZS5jb20uc2ciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzczNjQ4MTU4LCJleHAiOjE3NzM3MzQ1NTh9.I1TGn4un-YKHehd8uudGGTREzijCoDRyRL-TAdJVBZE"
$BASE = "http://localhost:5001/api"
$H = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

function Req {
    param($Method, $Url, $Body = $null)
    try {
        if ($Body) { $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $H -Body $Body -UseBasicParsing -ErrorAction Stop }
        else { $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $H -UseBasicParsing -ErrorAction Stop }
        return @{ code=$r.StatusCode; body=$r.Content; ok=$true }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { $code = 0 }
        return @{ code=$code; body=$_.ErrorDetails.Message; ok=$false }
    }
}

# The test product we created earlier (69b7bba6df334c3c4738fb31)
# First check if it still exists
$testProdId = "69b7bba6df334c3c4738fb31"
$chk = Req -Method GET -Url "$BASE/inventory/products/$testProdId"
if ($chk.ok) {
    Write-Host "Product still exists: $testProdId"
} else {
    # Create a fresh one
    Write-Host "Product gone, creating fresh..."
    $catResp = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
    $catId = $catResp.categories[0]._id
    $units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
    $unitId = $units[0]._id
    $pb = (@{ name="TEST_PRODUCT_DELETE_ME"; sku="TST-DEL-004"; category=$catId; unitOfMeasurement=$unitId; costPrice=1; sellingPrice=2; reorderPoint=5; description="Automated test" } | ConvertTo-Json -Compress)
    $cr = Req -Method POST -Url "$BASE/inventory/products" -Body $pb
    Write-Host "Created: $($cr.code) $($cr.body)"
    $testProdId = ($cr.body | ConvertFrom-Json)._id
    Write-Host "New product ID: $testProdId"
}

# POST /inventory/products/:id/pool  (requires action open/close + bottleCount)
# Check product's canSellLoose and containerCapacity first
$prodData = ($chk.body | ConvertFrom-Json)
Write-Host "canSellLoose: $($prodData.canSellLoose), containerCapacity: $($prodData.containerCapacity), currentStock: $($prodData.currentStock)"

# Try pool open
$poolBody = (@{ action="open"; bottleCount=1 } | ConvertTo-Json -Compress)
$r3 = Req -Method POST -Url "$BASE/inventory/products/$testProdId/pool" -Body $poolBody
Write-Host "POST /inventory/products/:id/pool (open) -> $($r3.code): $($r3.body)"

# POST /inventory/products/bulk-delete (correct field: productIds)
$bulkBody = (@{ productIds=@($testProdId) } | ConvertTo-Json -Compress)
$r4 = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $bulkBody
Write-Host "POST /inventory/products/bulk-delete -> $($r4.code): $($r4.body)"

# Also try DELETE /inventory/products/:id on a fresh product to verify that endpoint
Write-Host "DELETE /inventory/products/:id -> used bulk-delete above as the cleanup path"
