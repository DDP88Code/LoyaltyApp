$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$origin = "http://localhost:5173"
$headers = @{ Origin = $origin }

function Login-Session([string]$email, [string]$password) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$body = @{ email = $email; password = $password } | ConvertTo-Json -Compress
	$params = @{
		Method = "Post"
		Uri = "$origin/api/auth/sign-in/email"
		Headers = $headers
		ContentType = "application/json"
		Body = $body
		WebSession = $session
	}
	Invoke-RestMethod @params | Out-Null
	return $session
}

function Invoke-Json([string]$method, [string]$path, $session, $payload = $null) {
	$params = @{
		Method = $method
		Uri = "$origin$path"
		Headers = $headers
		WebSession = $session
	}
	if ($null -ne $payload) {
		$params.ContentType = "application/json"
		$params.Body = ($payload | ConvertTo-Json -Compress)
	}
	return Invoke-RestMethod @params
}

function Cookie-Header($session) {
	$cookies = $session.Cookies.GetCookies($origin)
	if (-not $cookies) { return "" }
	return ($cookies | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
}

function Upload-File([string]$cookieHeader, [string]$filePath, [string]$type) {
	return curl.exe -s -X POST -H "Origin: $origin" -H "Cookie: $cookieHeader" -F "file=@$filePath;type=$type" "$origin/api/admin/menu/media/upload"
}

$adminSession = Login-Session "admin@example.test" "CoffeeBeans2026"
$customerSession = Login-Session "thandi@example.test" "CoffeeBeans2026"
$adminCookie = Cookie-Header $adminSession

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$categoryName = "Phase9 Category $stamp"
$itemName = "Phase9 Item $stamp"

# Category create/edit/activate/deactivate/sort
$createdCategory = Invoke-Json "Post" "/api/admin/menu/categories" $adminSession @{
	name = $categoryName
	description = "Category created by Phase 9 smoke test"
	sortOrder = 91
	active = $true
	imageKey = $null
}
$categoryId = $createdCategory.data.id

$updatedCategory = Invoke-Json "Patch" "/api/admin/menu/categories/$categoryId" $adminSession @{
	name = "$categoryName Updated"
	sortOrder = 92
	active = $false
}
if ($updatedCategory.data.active -ne $false) {
	throw "Category deactivate check failed"
}

$reactivatedCategory = Invoke-Json "Patch" "/api/admin/menu/categories/$categoryId" $adminSession @{
	active = $true
}
if ($reactivatedCategory.data.active -ne $true) {
	throw "Category re-activate check failed"
}

# Item create/edit/sold-out/sort
$createdItem = Invoke-Json "Post" "/api/admin/menu/items" $adminSession @{
	categoryId = $categoryId
	name = $itemName
	description = "Item created by Phase 9 smoke test"
	priceCents = 4599
	imageKey = $null
	active = $true
	available = $true
	popular = $false
	vegetarian = $false
	spicy = $false
	sortOrder = 77
}
$itemId = $createdItem.data.id

$updatedItem = Invoke-Json "Patch" "/api/admin/menu/items/$itemId" $adminSession @{
	description = "Updated description"
	available = $false
	popular = $true
	spicy = $true
	sortOrder = 78
}
if ($updatedItem.data.available -ne $false) {
	throw "Sold-out update check failed"
}

# Gate 9 check: admin item update is visible in customer menu
$customerMenu = Invoke-Json "Get" "/api/customer/menu" $customerSession
$foundItem = $null
foreach ($category in $customerMenu.data.categories) {
	foreach ($item in $category.items) {
		if ($item.id -eq $itemId) {
			$foundItem = $item
			break
		}
	}
	if ($null -ne $foundItem) { break }
}
if ($null -eq $foundItem) {
	throw "Created item not found in customer menu"
}
if ($foundItem.available -ne $false) {
	throw "Customer menu did not reflect sold-out state"
}

# Upload validation: invalid file type
$invalidUploadRaw = Upload-File $adminCookie "README.md" "text/plain"
$invalidUpload = $invalidUploadRaw | ConvertFrom-Json
if ($invalidUpload.success -ne $false -or $invalidUpload.error.code -ne "validation_failed") {
	throw "Invalid file type was not rejected"
}

# Upload validation: oversized file
$largeFilePath = Join-Path $PWD "phase9-large.png"
[IO.File]::WriteAllBytes($largeFilePath, (New-Object byte[] (6MB)))
try {
	$largeUploadRaw = Upload-File $adminCookie $largeFilePath "image/png"
	$largeUpload = $largeUploadRaw | ConvertFrom-Json
	if ($largeUpload.success -ne $false -or $largeUpload.error.code -ne "validation_failed") {
		throw "Oversized image was not rejected"
	}
} finally {
	if (Test-Path $largeFilePath) {
		Remove-Item $largeFilePath -Force
	}
}

# Upload valid image and attach to menu item
$uploadA = (Upload-File $adminCookie "public/icons/icon-192.png" "image/png" | ConvertFrom-Json)
if ($uploadA.success -ne $true) {
	throw "Valid image upload failed"
}
$imageKeyA = $uploadA.data.imageKey

Invoke-Json "Patch" "/api/admin/menu/items/$itemId" $adminSession @{
	imageKey = $imageKeyA
} | Out-Null

# Secure retrieval: customer can read own-business media
$encodedA = [Uri]::EscapeDataString($imageKeyA)
$imageResponse = Invoke-WebRequest -Method Get -Uri "$origin/api/media/object?key=$encodedA" -Headers $headers -WebSession $customerSession
if ($imageResponse.StatusCode -ne 200) {
	throw "Media retrieval returned non-200"
}
if (-not $imageResponse.Headers["Content-Type"].StartsWith("image/")) {
	throw "Media retrieval content type was not an image"
}

# Safe delete: image in use cannot be deleted
$inUseBlocked = $false
try {
	Invoke-Json "Post" "/api/admin/menu/media/delete" $adminSession @{ imageKey = $imageKeyA } | Out-Null
} catch {
	$code = [int]$_.Exception.Response.StatusCode
	if ($code -eq 409) {
		$inUseBlocked = $true
	} else {
		throw
	}
}
if (-not $inUseBlocked) {
	throw "In-use image delete was not blocked"
}

# Replace image and verify old object is removed
$uploadB = (Upload-File $adminCookie "public/icons/icon-512.png" "image/png" | ConvertFrom-Json)
if ($uploadB.success -ne $true) {
	throw "Replacement image upload failed"
}
$imageKeyB = $uploadB.data.imageKey

Invoke-Json "Patch" "/api/admin/menu/items/$itemId" $adminSession @{
	imageKey = $imageKeyB
} | Out-Null

$oldGone = $false
try {
	Invoke-WebRequest -Method Get -Uri "$origin/api/media/object?key=$encodedA" -Headers $headers -WebSession $customerSession | Out-Null
} catch {
	$code = [int]$_.Exception.Response.StatusCode
	if ($code -eq 404) {
		$oldGone = $true
	} else {
		throw
	}
}
if (-not $oldGone) {
	throw "Replaced image key still resolves"
}

# Detach image then delete safely
Invoke-Json "Patch" "/api/admin/menu/items/$itemId" $adminSession @{
	imageKey = $null
} | Out-Null

$deleteFinal = Invoke-Json "Post" "/api/admin/menu/media/delete" $adminSession @{
	imageKey = $imageKeyB
}
if ($deleteFinal.data.deleted -ne $true) {
	throw "Final image delete did not return deleted=true"
}

$encodedB = [Uri]::EscapeDataString($imageKeyB)
$newGone = $false
try {
	Invoke-WebRequest -Method Get -Uri "$origin/api/media/object?key=$encodedB" -Headers $headers -WebSession $customerSession | Out-Null
} catch {
	$code = [int]$_.Exception.Response.StatusCode
	if ($code -eq 404) {
		$newGone = $true
	} else {
		throw
	}
}
if (-not $newGone) {
	throw "Deleted image key still resolves"
}

Write-Output "Phase 9 smoke checks passed"
Write-Output "categoryId=$categoryId itemId=$itemId"