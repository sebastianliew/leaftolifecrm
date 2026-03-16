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

# Get a valid category ID - categories are wrapped in {"categories":[...]}
$catResp = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
$catId = $catResp.categories[0]._id
Write-Host "Using catId: $catId"

# Get a valid unit ID
$units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
$unitId = $units[0]._id
Write-Host "Using unitId: $unitId"

# Existing product for restock tests
$prodsResp = (Req -Method GET -Url "$BASE/inventory/products").body | ConvertFrom-Json
$prodList = if ($prodsResp.products) { $prodsResp.products } elseif ($prodsResp.data) { $prodsResp.data } else { $prodsResp }
$existingProdId = $prodList[0]._id
Write-Host "Existing product ID: $existingProdId"

# ========================
# POST /inventory/products
# ========================
$prodBody = (@{
    name = "TEST_PRODUCT_DELETE_ME"
    sku = "TST-DEL-002"
    category = $catId
    unit = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    stockQuantity = 0
    reorderPoint = 5
    description = "Automated test product"
} | ConvertTo-Json -Compress)

$r1 = Req -Method POST -Url "$BASE/inventory/products" -Body $prodBody
Write-Host "POST /inventory/products -> $($r1.code): $($r1.body)"

$newProdId = $null
if ($r1.ok) {
    $newProdId = ($r1.body | ConvertFrom-Json)._id
    Write-Host "Created product ID: $newProdId"
}

# ========================
# PUT /inventory/products/:id
# ========================
if ($newProdId) {
    $putBody = (@{ name="TEST_PRODUCT_DELETE_ME"; description="Updated"; sellingPrice=3.00 } | ConvertTo-Json -Compress)
    $r2 = Req -Method PUT -Url "$BASE/inventory/products/$newProdId" -Body $putBody
    Write-Host "PUT /inventory/products/$newProdId -> $($r2.code): $($r2.body)"
} else {
    Write-Host "PUT /inventory/products/:id -> SKIPPED (no product created)"
}

# ========================
# POST /inventory/products/:id/pool
# ========================
if ($newProdId) {
    $poolBody = (@{ quantity=10; notes="Test pool add" } | ConvertTo-Json -Compress)
    $r3 = Req -Method POST -Url "$BASE/inventory/products/$newProdId/pool" -Body $poolBody
    Write-Host "POST /inventory/products/$newProdId/pool -> $($r3.code): $($r3.body)"
} else {
    Write-Host "POST /inventory/products/:id/pool -> SKIPPED (no product created)"
}

# ========================
# POST /inventory/products/bulk-delete (cleanup)
# ========================
if ($newProdId) {
    $bulkBody = (@{ ids=@($newProdId) } | ConvertTo-Json -Compress)
    $r4 = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $bulkBody
    Write-Host "POST /inventory/products/bulk-delete -> $($r4.code): $($r4.body)"
} else {
    Write-Host "POST /inventory/products/bulk-delete -> SKIPPED (no product created)"
}

# ========================
# POST /inventory/restock/bulk  (correct field: productId not product)
# ========================
$bulkRestockBody = (@{
    operations = @(@{ productId=$existingProdId; quantity=2; notes="Automated bulk restock test" })
} | ConvertTo-Json -Compress)
$rb = Req -Method POST -Url "$BASE/inventory/restock/bulk" -Body $bulkRestockBody
Write-Host "POST /inventory/restock/bulk -> $($rb.code): $($rb.body)"
