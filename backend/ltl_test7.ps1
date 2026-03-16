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

$catResp = (Req -Method GET -Url "$BASE/inventory/categories").body | ConvertFrom-Json
$catId = $catResp.categories[0]._id
$units = (Req -Method GET -Url "$BASE/inventory/units").body | ConvertFrom-Json
$unitId = $units[0]._id

# Step 1: Create product
$pb = (@{ name="TEST_POOL2_DELETE_ME"; sku="TST-POOL-002"; category=$catId; unitOfMeasurement=$unitId; costPrice=1; sellingPrice=2; reorderPoint=5 } | ConvertTo-Json -Compress)
$cr = Req -Method POST -Url "$BASE/inventory/products" -Body $pb
$pid = ($cr.body | ConvertFrom-Json)._id
Write-Host "Created product: $pid"

# Step 2: Enable canSellLoose via PUT
$enableBody = (@{ canSellLoose=$true; containerCapacity=10; currentStock=5 } | ConvertTo-Json -Compress)
$er = Req -Method PUT -Url "$BASE/inventory/products/$pid" -Body $enableBody
Write-Host "PUT canSellLoose -> $($er.code)"
$ep = $er.body | ConvertFrom-Json
Write-Host "canSellLoose after PUT: $($ep.canSellLoose), currentStock: $($ep.currentStock)"

# Step 3: POST pool open
$poolBody = (@{ action="open"; bottleCount=1 } | ConvertTo-Json -Compress)
$pr = Req -Method POST -Url "$BASE/inventory/products/$pid/pool" -Body $poolBody
Write-Host "POST /inventory/products/:id/pool (open) -> $($pr.code): $($pr.body)"

# Cleanup
$delBody = (@{ productIds=@($pid) } | ConvertTo-Json -Compress)
$dr = Req -Method POST -Url "$BASE/inventory/products/bulk-delete" -Body $delBody
Write-Host "Cleanup -> $($dr.code)"
