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

# Create a product with canSellLoose=true, then test the pool endpoint
$catResp = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
$catId = $catResp.categories[0]._id
$units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
$unitId = $units[0]._id

$pb = (@{
    name = "TEST_POOL_DELETE_ME"
    sku = "TST-POOL-001"
    category = $catId
    unitOfMeasurement = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    reorderPoint = 5
    description = "Test pool product"
    canSellLoose = $true
    containerCapacity = 10
    currentStock = 5
} | ConvertTo-Json -Compress)

$cr = Req -Method POST -Url "$BASE/inventory/products" -Body $pb
Write-Host "POST /inventory/products (pool test) -> $($cr.code)"
$poolProdId = ($cr.body | ConvertFrom-Json)._id
Write-Host "Pool product ID: $poolProdId"

# Try pool open
$poolBody = (@{ action="open"; bottleCount=1 } | ConvertTo-Json -Compress)
$r3 = Req -Method POST -Url "$BASE/inventory/products/$poolProdId/pool" -Body $poolBody
Write-Host "POST /inventory/products/:id/pool (open) -> $($r3.code): $($r3.body)"

# DELETE the pool test product
$delBody = (@{ productIds=@($poolProdId) } | ConvertTo-Json -Compress)
$rdel = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $delBody
Write-Host "Cleanup pool product -> $($rdel.code): $($rdel.body)"

# Also test DELETE /inventory/products/:id directly
# Create one more product then delete it with DELETE method
$pb2 = (@{
    name = "TEST_DEL_DIRECT_ME"
    sku = "TST-DEL-DIRECT-001"
    category = $catId
    unitOfMeasurement = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    reorderPoint = 5
} | ConvertTo-Json -Compress)
$cr2 = Req -Method POST -Url "$BASE/inventory/products" -Body $pb2
$delProdId = ($cr2.body | ConvertFrom-Json)._id
Write-Host "Created for DELETE test: $delProdId"
$rdel2 = Req -Method DELETE -Url "$BASE/inventory/products/$delProdId"
Write-Host "DELETE /inventory/products/:id -> $($rdel2.code): $($rdel2.body)"
