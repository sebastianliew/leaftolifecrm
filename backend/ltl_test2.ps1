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

# Get a valid category ID from existing categories
$cats = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
$catId = $cats[0]._id
Write-Host "Using catId: $catId"

# Get a valid unit ID
$units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
$unitId = $units[0]._id
Write-Host "Using unitId: $unitId"

# POST /inventory/products
$prodBody = (@{
    name = "TEST_PRODUCT_DELETE_ME"
    sku = "TST-DEL-001"
    category = $catId
    unit = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    stockQuantity = 0
    reorderPoint = 5
    description = "Automated test product"
} | ConvertTo-Json -Compress)

$r1 = Req -Method POST -Url "$BASE/inventory/products" -Body $prodBody
Write-Host "POST /inventory/products -> $($r1.code)"
Write-Host $r1.body

if ($r1.ok) {
    $newProd = $r1.body | ConvertFrom-Json
    $newProdId = $newProd._id
    Write-Host "Created product ID: $newProdId"

    # PUT /inventory/products/:id
    $putBody = (@{ name="TEST_PRODUCT_DELETE_ME"; description="Updated test product"; sellingPrice=3.00 } | ConvertTo-Json -Compress)
    $r2 = Req -Method PUT -Url "$BASE/inventory/products/$newProdId" -Body $putBody
    Write-Host "PUT /inventory/products/$newProdId -> $($r2.code)"

    # POST /inventory/products/:id/pool
    $poolBody = (@{ quantity=10; notes="Test pool add" } | ConvertTo-Json -Compress)
    $r3 = Req -Method POST -Url "$BASE/inventory/products/$newProdId/pool" -Body $poolBody
    Write-Host "POST /inventory/products/$newProdId/pool -> $($r3.code)"
    Write-Host $r3.body

    # POST /inventory/products/bulk-delete (cleanup)
    $bulkBody = (@{ ids=@($newProdId) } | ConvertTo-Json -Compress)
    $r4 = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $bulkBody
    Write-Host "POST /inventory/products/bulk-delete -> $($r4.code)"
    Write-Host $r4.body
} else {
    Write-Host "Product creation failed - cannot test PUT, pool, bulk-delete"
}

# POST /inventory/restock/bulk  -- investigate expected payload
# Check existing products list for a valid product
$prods = (Req -Method GET -Url "$BASE/inventory/products").body | ConvertFrom-Json
$prodList = if ($prods.products) { $prods.products } elseif ($prods.data) { $prods.data } else { $prods }
$existingProdId = $prodList[0]._id
Write-Host "Existing product for restock: $existingProdId"

# Try bulk restock with 'operations' key
$bulkRestockBody1 = (@{ operations=@(@{ product=$existingProdId; quantity=5; notes="Bulk test" }) } | ConvertTo-Json -Compress)
$rb1 = Req -Method POST -Url "$BASE/inventory/restock/bulk" -Body $bulkRestockBody1
Write-Host "POST /restock/bulk (operations key) -> $($rb1.code): $($rb1.body)"

# Try with 'items' key
$bulkRestockBody2 = (@{ items=@(@{ product=$existingProdId; quantity=5; notes="Bulk test" }) } | ConvertTo-Json -Compress)
$rb2 = Req -Method POST -Url "$BASE/inventory/restock/bulk" -Body $bulkRestockBody2
Write-Host "POST /restock/bulk (items key) -> $($rb2.code): $($rb2.body)"

# Try as raw array
$bulkRestockBody3 = (@(@{ product=$existingProdId; quantity=5; notes="Bulk test" }) | ConvertTo-Json -Compress)
$rb3 = Req -Method POST -Url "$BASE/inventory/restock/bulk" -Body $bulkRestockBody3
Write-Host "POST /restock/bulk (array) -> $($rb3.code): $($rb3.body)"
