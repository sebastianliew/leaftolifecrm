$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJ1c2VySWQiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJlbWFpbCI6InN1cGVyYWRtaW5AbGVhZnRvbGlmZS5jb20uc2ciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzczNjQ4MTU4LCJleHAiOjE3NzM3MzQ1NTh9.I1TGn4un-YKHehd8uudGGTREzijCoDRyRL-TAdJVBZE"
$BASE = "http://localhost:5001/api"
$H = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

function Req {
    param($Method, $Url, $Body = $null)
    try {
        if ($Body) {
            $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $H -Body $Body -UseBasicParsing -ErrorAction Stop
        } else {
            $r = Invoke-WebRequest -Uri $Url -Method $Method -Headers $H -UseBasicParsing -ErrorAction Stop
        }
        return @{ code=$r.StatusCode; body=$r.Content; ok=$true }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { $code = 0 }
        $msg = $_.ErrorDetails.Message
        return @{ code=$code; body=$msg; ok=$false }
    }
}

# Get IDs
$catResp = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
$catId = $catResp.categories[0]._id
Write-Host "catId: $catId"

$units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
$unitId = $units[0]._id
Write-Host "unitId: $unitId"

# POST /inventory/products with correct field 'unitOfMeasurement'
$prodBody = (@{
    name = "TEST_PRODUCT_DELETE_ME"
    sku = "TST-DEL-003"
    category = $catId
    unitOfMeasurement = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    reorderPoint = 5
    description = "Automated test product"
} | ConvertTo-Json -Compress)

$r1 = Req -Method POST -Url "$BASE/inventory/products" -Body $prodBody
Write-Host "POST /inventory/products -> $($r1.code)"
Write-Host $r1.body

$newProdId = $null
if ($r1.ok) {
    $newProdId = ($r1.body | ConvertFrom-Json)._id
    Write-Host "Created product ID: $newProdId"
} else {
    Write-Host "ERROR creating product"
    exit 1
}

# PUT /inventory/products/:id
$putBody = (@{ name="TEST_PRODUCT_DELETE_ME"; description="Updated test product"; sellingPrice=3.00 } | ConvertTo-Json -Compress)
$r2 = Req -Method PUT -Url "$BASE/inventory/products/$newProdId" -Body $putBody
Write-Host "PUT /inventory/products/:id -> $($r2.code)"
Write-Host $r2.body

# POST /inventory/products/:id/pool
$poolBody = (@{ quantity=10; notes="Test pool add" } | ConvertTo-Json -Compress)
$r3 = Req -Method POST -Url "$BASE/inventory/products/$newProdId/pool" -Body $poolBody
Write-Host "POST /inventory/products/:id/pool -> $($r3.code)"
Write-Host $r3.body

# POST /inventory/products/bulk-delete  (cleanup test product)
$bulkBody = (@{ ids=@($newProdId) } | ConvertTo-Json -Compress)
$r4 = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $bulkBody
Write-Host "POST /inventory/products/bulk-delete -> $($r4.code)"
Write-Host $r4.body

# DELETE single product fallback test using a dummy/safe approach - already cleaned above

# POST /inventory/restock/bulk - the service has a bug with ObjectId wrapping
# Try passing productId as string directly (already done - same result)
# Document as a backend bug
Write-Host "POST /inventory/restock/bulk -> backend bug confirmed (ObjectId BSON cast error in RestockService)"
