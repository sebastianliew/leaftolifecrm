# LeafToLife Inventory API Test - v2
Write-Host "=== LeafToLife Inventory API Test v2 ===" -ForegroundColor Cyan
Write-Host "Started: $(Get-Date)" -ForegroundColor Gray
Write-Host ""

# Auth
$loginBody = '{"email":"superadmin@leaftolife.com.sg","password":"NewPassword123!"}'
$r = Invoke-WebRequest -Uri "http://localhost:5001/api/auth/login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $loginBody -UseBasicParsing
$TOKEN = ($r.Content | ConvertFrom-Json).accessToken
$H = @{ Authorization = "Bearer $TOKEN" }
$BASE = "http://localhost:5001/api"
Write-Host "Auth OK" -ForegroundColor Green
Write-Host ""

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function T { param($m, $ep, $b, $n)
    if (-not $n) { $n = "" }
    $url = "$BASE$ep"
    try {
        if ($b) { $resp = Invoke-WebRequest -Uri $url -Method $m -Headers $H -Body $b -ContentType "application/json" -UseBasicParsing }
        else { $resp = Invoke-WebRequest -Uri $url -Method $m -Headers $H -UseBasicParsing }
        $obj = [PSCustomObject]@{ ep=$ep; status=$resp.StatusCode; result="PASS"; notes=$n; content=$resp.Content }
        $results.Add($obj)
        Write-Host "  PASS $m $ep -> $($resp.StatusCode)" -ForegroundColor Green
        return $obj
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = $_.Exception.Response.StatusCode.value__ }
        $errBody = $_.Exception.Message
        $obj = [PSCustomObject]@{ ep=$ep; status=$code; result="FAIL"; notes=$errBody; content="" }
        $results.Add($obj)
        Write-Host "  FAIL $m $ep -> $code" -ForegroundColor Red
        return $obj
    }
}

function Skip { param($ep, $reason)
    $obj = [PSCustomObject]@{ ep=$ep; status=0; result="SKIP"; notes=$reason; content="" }
    $results.Add($obj)
    Write-Host "  SKIP $ep ($reason)" -ForegroundColor Gray
}

# ===== UNITS =====
Write-Host "=== UNITS ===" -ForegroundColor Cyan
T GET "/inventory/units" $null "List all units"
T GET "/inventory/units/68acf68a7ed2e820738bf371" $null "Get Capsule"

$uPost = T POST "/inventory/units" '{"name":"TEST_UNIT_API_20260316","abbreviation":"tua26","type":"count","description":"API test unit","isActive":true}' "Create unit"
$uId = $null
if ($uPost.result -eq "PASS") { $uId = ($uPost.content | ConvertFrom-Json)._id; Write-Host "    Created unit: $uId" -ForegroundColor Yellow }

if ($uId) { T PUT "/inventory/units/$uId" '{"name":"TEST_UNIT_UPDATED"}' "Update unit" } else { Skip "PUT /inventory/units/:id" "No unit created" }
if ($uId) { T DELETE "/inventory/units/$uId" $null "Delete unit" } else { Skip "DELETE /inventory/units/:id" "No unit created" }

# ===== CATEGORIES =====
Write-Host "" ; Write-Host "=== CATEGORIES ===" -ForegroundColor Cyan
$catList = T GET "/inventory/categories" $null "List all categories"
$catId = $null
if ($catList.result -eq "PASS") {
    $catJson = $catList.content | ConvertFrom-Json
    if ($catJson.categories -and $catJson.categories.Count -gt 0) { $catId = $catJson.categories[0]._id }
    elseif ($catJson.data -and $catJson.data.Count -gt 0) { $catId = $catJson.data[0]._id }
    Write-Host "    First category: $catId" -ForegroundColor Yellow
}

if ($catId) { T GET "/inventory/categories/$catId" $null "Get first category" } else { Skip "GET /inventory/categories/:id" "No category ID" }

$cPost = T POST "/inventory/categories" '{"name":"TEST_CAT_API_20260316","description":"API test","isActive":true}' "Create category"
$cId = $null
if ($cPost.result -eq "PASS") { $cId = ($cPost.content | ConvertFrom-Json)._id; Write-Host "    Created category: $cId" -ForegroundColor Yellow }

if ($cId) { T PUT "/inventory/categories/$cId" '{"name":"TEST_CAT_UPDATED"}' "Update category" } else { Skip "PUT /inventory/categories/:id" "No category created" }
if ($cId) { T DELETE "/inventory/categories/$cId" $null "Delete category" } else { Skip "DELETE /inventory/categories/:id" "No category created" }

# ===== PRODUCTS =====
Write-Host "" ; Write-Host "=== PRODUCTS ===" -ForegroundColor Cyan
T GET "/inventory/products/stats" $null "Product stats"
$prodList = T GET "/inventory/products" $null "List all products"
T GET "/inventory/products/templates" $null "Product templates"
T GET "/inventory/products/export" $null "Export to Excel"

$pId = $null
if ($prodList.result -eq "PASS") {
    $prodJson = $prodList.content | ConvertFrom-Json
    if ($prodJson.products -and $prodJson.products.Count -gt 0) { $pId = $prodJson.products[0]._id }
    elseif ($prodJson.data -and $prodJson.data.Count -gt 0) { $pId = $prodJson.data[0]._id }
    Write-Host "    First product: $pId" -ForegroundColor Yellow
}

if ($pId) { T GET "/inventory/products/$pId" $null "Get first product" } else { Skip "GET /inventory/products/:id" "No product ID" }

$newPId = $null
if ($catId) {
    $prodBody = "{""name"":""TEST_PROD_API_20260316"",""sku"":""TESTPROD2026"",""type"":""product"",""price"":10,""costPrice"":5,""stock"":50,""categoryId"":""$catId"",""isActive"":true}"
    $pPost = T POST "/inventory/products" $prodBody "Create product"
    if ($pPost.result -eq "PASS") { $newPId = ($pPost.content | ConvertFrom-Json)._id; Write-Host "    Created product: $newPId" -ForegroundColor Yellow }
} else { Skip "POST /inventory/products" "No categoryId available" }

if ($newPId) { T PUT "/inventory/products/$newPId" '{"name":"TEST_PROD_UPDATED","price":15}' "Update product" } else { Skip "PUT /inventory/products/:id" "No product created" }
if ($newPId) { T POST "/inventory/products/$newPId/pool" '{"quantity":10}' "Add to pool" } else { Skip "POST /inventory/products/:id/pool" "No product created" }
if ($newPId) { T DELETE "/inventory/products/$newPId" $null "Delete product" } else { Skip "DELETE /inventory/products/:id" "No product created" }
if ($pId) { T POST "/inventory/products/bulk-delete" "{""ids"":[""$pId""]}" "Bulk delete (1 ID)" } else { Skip "POST /inventory/products/bulk-delete" "No product ID" }

# ===== RESTOCK =====
Write-Host "" ; Write-Host "=== RESTOCK ===" -ForegroundColor Cyan
T GET "/inventory/restock/suggestions" $null "Restock suggestions"
if ($pId) { T POST "/inventory/restock" "{""productId"":""$pId"",""quantity"":100}" "Create restock order" } else { Skip "POST /inventory/restock" "No product ID" }
T GET "/inventory/restock" $null "List restock orders"
if ($pId) { T POST "/inventory/restock/bulk" "{""operations"":[{""productId"":""$pId"",""quantity"":50}]}" "Bulk restock" } else { Skip "POST /inventory/restock/bulk" "No product ID" }
T GET "/inventory/restock/batches" $null "List batches"

# ===== REPORT =====
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " LEAFTOLIFE INVENTORY API TEST RESULTS v2" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ("ENDPOINT".PadRight(42) + "STATUS  RESULT  NOTES") -ForegroundColor White
Write-Host ("-" * 100) -ForegroundColor Gray

foreach ($row in $results) {
    $c = if ($row.result -eq "PASS") { "Green" } elseif ($row.result -eq "FAIL") { "Red" } else { "Gray" }
    $note = $row.notes
    if ($row.result -eq "FAIL") {
        try { $parsed = $row.notes | ConvertFrom-Json -ErrorAction Stop; if ($parsed.error) { $note = $parsed.error } } catch {}
    }
    Write-Host ($row.ep.PadRight(42) + $row.status.ToString().PadRight(8) + $row.result.PadRight(8) + $note) -ForegroundColor $c
}

Write-Host ("-" * 100) -ForegroundColor Gray
$total = $results.Count
$passed = ($results | Where-Object { $_.result -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.result -eq "FAIL" }).Count
$skipped = ($results | Where-Object { $_.result -eq "SKIP" }).Count
$tested = $total - $skipped
Write-Host ""
Write-Host "SUMMARY: $passed PASS | $failed FAIL | $skipped SKIP | Total: $total" -ForegroundColor White
if ($tested -gt 0) { Write-Host "Pass rate: $([math]::Round($passed / $tested * 100, 1))% (excl. skips)" -ForegroundColor Cyan }
Write-Host "Completed: $(Get-Date)" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
