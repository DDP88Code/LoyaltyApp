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

function Expect-HttpStatus([ScriptBlock]$action, [int]$status) {
	$matched = $false
	try {
		& $action | Out-Null
	} catch {
		$code = [int]$_.Exception.Response.StatusCode
		if ($code -eq $status) {
			$matched = $true
		} else {
			throw
		}
	}
	if (-not $matched) {
		throw "Expected HTTP $status but request succeeded"
	}
}

function Cookie-Header($session) {
	$cookies = $session.Cookies.GetCookies($origin)
	if (-not $cookies) { return "" }
	return ($cookies | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
}

function Upload-File([string]$cookieHeader, [string]$filePath, [string]$type) {
	return curl.exe -s -X POST -H "Origin: $origin" -H "Cookie: $cookieHeader" -F "file=@$filePath;type=$type" "$origin/api/admin/promotions/media/upload"
}

$adminSession = Login-Session "admin@example.test" "CoffeeBeans2026"
$customerSession = Login-Session "thandi@example.test" "CoffeeBeans2026"
$adminCookie = Cookie-Header $adminSession

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$title = "Phase10 Promo $stamp"

# Create
$now = [DateTimeOffset]::UtcNow
$start = $now.AddMinutes(-3).ToString("o")
$end = $now.AddDays(3).ToString("o")

$created = Invoke-Json "Post" "/api/admin/promotions" $adminSession @{
	title = $title
	subtitle = "Smoke subtitle"
	description = "Phase 10 smoke promotion"
	imageKey = $null
	startAt = $start
	endAt = $end
	active = $true
	ctaText = "Browse Menu"
	ctaUrl = "/app/menu"
}
$promotionId = $created.data.id

if (-not $promotionId) {
	throw "Promotion create failed"
}

# Edit
$updated = Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	title = "$title Updated"
	subtitle = "Updated subtitle"
	ctaText = "Explore"
	ctaUrl = "/app/menu"
}
if ($updated.data.title -ne "$title Updated") {
	throw "Promotion edit did not persist"
}

# Timing logic: future hidden
$futureStart = $now.AddDays(1).ToString("o")
$futureEnd = $now.AddDays(2).ToString("o")
Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	startAt = $futureStart
	endAt = $futureEnd
	active = $true
} | Out-Null

$homeFuture = Invoke-Json "Get" "/api/customer/home" $customerSession
if (
	$homeFuture.data.activePromotion -and
	$homeFuture.data.activePromotion.id -eq $promotionId
) {
	throw "Future promotion was incorrectly visible to customer"
}

# Timing logic: current shown
$currentStart = $now.AddMinutes(-1).ToString("o")
$currentEnd = $now.AddHours(2).ToString("o")
Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	startAt = $currentStart
	endAt = $currentEnd
	active = $true
} | Out-Null

$homeCurrent = Invoke-Json "Get" "/api/customer/home" $customerSession
if (
	-not $homeCurrent.data.activePromotion -or
	$homeCurrent.data.activePromotion.id -ne $promotionId
) {
	throw "Current promotion was not shown to customer"
}

# Timing logic: expired hidden
$expiredStart = $now.AddDays(-3).ToString("o")
$expiredEnd = $now.AddDays(-1).ToString("o")
Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	startAt = $expiredStart
	endAt = $expiredEnd
	active = $true
} | Out-Null

$homeExpired = Invoke-Json "Get" "/api/customer/home" $customerSession
if (
	$homeExpired.data.activePromotion -and
	$homeExpired.data.activePromotion.id -eq $promotionId
) {
	throw "Expired promotion was incorrectly visible to customer"
}

# Image upload validation and attach
$invalidUpload = (Upload-File $adminCookie "README.md" "text/plain" | ConvertFrom-Json)
if ($invalidUpload.success -ne $false -or $invalidUpload.error.code -ne "validation_failed") {
	throw "Invalid promotion image upload was not rejected"
}

$upload = (Upload-File $adminCookie "public/icons/icon-512.png" "image/png" | ConvertFrom-Json)
if ($upload.success -ne $true) {
	throw "Valid promotion image upload failed"
}
$imageKey = $upload.data.imageKey

Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	imageKey = $imageKey
} | Out-Null

$encoded = [Uri]::EscapeDataString($imageKey)
$imageRequestParams = @{
	Method = "Get"
	Uri = "$origin/api/media/object?key=$encoded"
	Headers = $headers
	WebSession = $customerSession
}
if ($PSVersionTable.PSVersion.Major -lt 6) {
	$imageRequestParams.UseBasicParsing = $true
}
$imageResponse = Invoke-WebRequest @imageRequestParams
if ($imageResponse.StatusCode -ne 200) {
	throw "Promotion image retrieval failed"
}

# In-use delete blocked
Expect-HttpStatus {
	Invoke-Json "Post" "/api/admin/promotions/media/delete" $adminSession @{ imageKey = $imageKey }
} 409

# Deactivate and delete safe path
Invoke-Json "Patch" "/api/admin/promotions/$promotionId" $adminSession @{
	active = $false
	imageKey = $null
} | Out-Null

$deletedImage = Invoke-Json "Post" "/api/admin/promotions/media/delete" $adminSession @{ imageKey = $imageKey }
if ($deletedImage.data.deleted -ne $true) {
	throw "Promotion image delete did not return deleted=true"
}

$deletablePromo = Invoke-Json "Post" "/api/admin/promotions" $adminSession @{
	title = "Phase10 Delete Guard $stamp"
	startAt = $currentStart
	endAt = $currentEnd
	active = $true
} 
$guardId = $deletablePromo.data.id

# Active + unexpired delete should be blocked
Expect-HttpStatus {
	Invoke-Json "Delete" "/api/admin/promotions/$guardId" $adminSession
} 409

# Deactivate then delete should pass
Invoke-Json "Patch" "/api/admin/promotions/$guardId" $adminSession @{ active = $false } | Out-Null
$deletedPromotion = Invoke-Json "Delete" "/api/admin/promotions/$guardId" $adminSession
if ($deletedPromotion.data.deleted -ne $true) {
	throw "Promotion delete did not return deleted=true"
}

Write-Output "Phase 10 smoke checks passed"
Write-Output "promotionId=$promotionId guardId=$guardId"