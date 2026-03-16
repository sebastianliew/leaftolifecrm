$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJ1c2VySWQiOiI2OWI3OTBhYzdhYWZhYTZlZDEzZTVlMDkiLCJlbWFpbCI6InN1cGVyYWRtaW5AbGVhZnRvbGlmZS5jb20uc2ciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzczNjQ4MTU4LCJleHAiOjE3NzM3MzQ1NTh9.I1TGn4un-YKHehd8uudGGTREzijCoDRyRL-TAdJVBZE"
$BASE = "http://localhost:5001/api"
$HEADERS = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

$results = @()

function Test-Endpoint {
    param($Method, $Path, $Body = $null, $Label = $null)
    $url = "$BASE$Path"
    $label = if ($Label) { $Label } else { "$Method $Path" }
    try {
        if ($Body) {
            $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers $HEADERS -Body ($Body | ConvertTo-Json -Compress) -UseBasicParsing -ErrorAction Stop
        } else {
            $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers $HEADERS -UseBasicParsing -ErrorAction Stop
        }
        $code = $resp.StatusCode
        $content = $resp.Content
        $pass = if ($code -ge 200 -and $code -lt 300) { "PASS" } else { "FAIL" }
        return [PSCustomObject]@{ Label=$label; Code=$code; Result=$pass; Body=$content }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { $code = "ERR" }
        $errBody = ""
        try { $errBody = $_.ErrorDetails.Message } catch {}
        return [PSCustomObject]@{ Label=$label; Code=$code; Result="FAIL"; Body=$errBody }
    }
}

# ========================
# UNITS
# ========================

# GET all units
$r = Test-Endpoint -Method GET -Path "/inventory/units"
$results += $r

# Get first unit ID
$units = $r.Body | ConvertFrom-Json
$unitId = $units[0]._id
Write-Host "Using unit ID: $unitId"

# GET single unit
$results += Test-Endpoint -Method GET -Path "/inventory/units/$unitId"

# POST create test unit
$newUnit = @{ name="TEST_UNIT_DELETE_ME"; abbreviation="tst"; type="count"; description="Automated test unit" }
$createUnitResp = Test-Endpoint -Method POST -Path "/inventory/units" -Body $newUnit
$results += $createUnitResp
$createdUnitId = ($createUnitResp.Body | ConvertFrom-Json)._id
Write-Host "Created unit ID: $createdUnitId"

# PUT update test unit
$updateUnit = @{ name="TEST_UNIT_DELETE_ME"; abbreviation="tst"; type="count"; description="Updated test unit" }
$results += Test-Endpoint -Method PUT -Path "/inventory/units/$createdUnitId" -Body $updateUnit

# DELETE test unit
$results += Test-Endpoint -Method DELETE -Path "/inventory/units/$createdUnitId"

# ========================
# CATEGORIES
# ========================

# GET all categories
$r = Test-Endpoint -Method GET -Path "/inventory/categories"
$results += $r
$cats = $r.Body | ConvertFrom-Json
$catId = $cats[0]._id
Write-Host "Using category ID: $catId"

# GET single category
$results += Test-Endpoint -Method GET -Path "/inventory/categories/$catId"

# POST create test category
$newCat = @{ name="TEST_CAT_DELETE_ME"; description="Automated test category" }
$createCatResp = Test-Endpoint -Method POST -Path "/inventory/categories" -Body $newCat
$results += $createCatResp
$createdCatId = ($createCatResp.Body | ConvertFrom-Json)._id
Write-Host "Created category ID: $createdCatId"

# PUT update test category
$updateCat = @{ name="TEST_CAT_DELETE_ME"; description="Updated test category" }
$results += Test-Endpoint -Method PUT -Path "/inventory/categories/$createdCatId" -Body $updateCat

# DELETE test category
$results += Test-Endpoint -Method DELETE -Path "/inventory/categories/$createdCatId"

# ========================
# PRODUCTS
# ========================

# GET stats
$results += Test-Endpoint -Method GET -Path "/inventory/products/stats"

# GET templates
$results += Test-Endpoint -Method GET -Path "/inventory/products/templates"

# GET export
$results += Test-Endpoint -Method GET -Path "/inventory/products/export"

# GET all products
$r = Test-Endpoint -Method GET -Path "/inventory/products"
$results += $r
$prods = $r.Body | ConvertFrom-Json

# Handle pagination wrapper or direct array
$prodList = if ($prods.products) { $prods.products } elseif ($prods.data) { $prods.data } else { $prods }
$prodId = if ($prodList.Count -gt 0) { $prodList[0]._id } else { $null }
Write-Host "Using product ID: $prodId"

# GET single product
if ($prodId) {
    $results += Test-Endpoint -Method GET -Path "/inventory/products/$prodId"
}

# POST create test product (minimal payload - adapt fields as needed)
$newProd = @{
    name = "TEST_PRODUCT_DELETE_ME"
    sku = "TST-DEL-001"
    category = $catId
    unit = $unitId
    costPrice = 1.00
    sellingPrice = 2.00
    stockQuantity = 0
    reorderPoint = 5
    description = "Automated test product"
}
$createProdResp = Test-Endpoint -Method POST -Path "/inventory/products" -Body $newProd
$results += $createProdResp
$createdProdId = ($createProdResp.Body | ConvertFrom-Json)._id
Write-Host "Created product ID: $createdProdId"

# PUT update test product
if ($createdProdId) {
    $updateProd = @{ name="TEST_PRODUCT_DELETE_ME"; description="Updated test product"; sellingPrice=3.00 }
    $results += Test-Endpoint -Method PUT -Path "/inventory/products/$createdProdId" -Body $updateProd

    # POST pool
    $poolBody = @{ quantity=10; notes="Test pool add" }
    $results += Test-Endpoint -Method POST -Path "/inventory/products/$createdProdId/pool" -Body $poolBody
}

# POST bulk-delete (using created product)
if ($createdProdId) {
    $bulkDel = @{ ids=@($createdProdId) }
    $results += Test-Endpoint -Method POST -Path "/inventory/products/bulk-delete" -Body $bulkDel -Label "POST /inventory/products/bulk-delete"
} else {
    # DELETE single product (fallback)
    $results += Test-Endpoint -Method DELETE -Path "/inventory/products/$prodId"
}

# ========================
# RESTOCK
# ========================

# GET suggestions
$results += Test-Endpoint -Method GET -Path "/inventory/restock/suggestions"

# GET restock list
$results += Test-Endpoint -Method GET -Path "/inventory/restock"

# GET batches
$results += Test-Endpoint -Method GET -Path "/inventory/restock/batches"

# POST create restock (needs a valid product; use first existing product)
if ($prodId) {
    $restockBody = @{
        items = @(@{ product=$prodId; quantity=10; notes="Test restock" })
    }
    $createRestockResp = Test-Endpoint -Method POST -Path "/inventory/restock" -Body $restockBody
    $results += $createRestockResp

    # POST bulk restock
    $bulkRestockBody = @{
        items = @(@{ product=$prodId; quantity=5; notes="Bulk test" })
    }
    $results += Test-Endpoint -Method POST -Path "/inventory/restock/bulk" -Body $bulkRestockBody
} else {
    $results += [PSCustomObject]@{ Label="POST /inventory/restock"; Code="SKIP"; Result="SKIP"; Body="No product ID available" }
    $results += [PSCustomObject]@{ Label="POST /inventory/restock/bulk"; Code="SKIP"; Result="SKIP"; Body="No product ID available" }
}

# ========================
# OUTPUT
# ========================
Write-Host ""
Write-Host "============================================================"
Write-Host "LEAFTOLIFE INVENTORY API TEST REPORT"
Write-Host "============================================================"
Write-Host ("{0,-50} {1,-6} {2,-6} {3}" -f "ENDPOINT", "CODE", "RESULT", "NOTES")
Write-Host ("-" * 120)
foreach ($r in $results) {
    $notes = ""
    if ($r.Result -eq "FAIL") {
        # Truncate body for display
        $notes = if ($r.Body.Length -gt 80) { $r.Body.Substring(0,80) } else { $r.Body }
    }
    Write-Host ("{0,-50} {1,-6} {2,-6} {3}" -f $r.Label, $r.Code, $r.Result, $notes)
}
Write-Host "============================================================"
Write-Host ""
Write-Host "RAW DETAILS (FAIL entries):"
foreach ($r in $results) {
    if ($r.Result -ne "PASS") {
        Write-Host ">> $($r.Label) [$($r.Code)]: $($r.Body)"
    }
}
