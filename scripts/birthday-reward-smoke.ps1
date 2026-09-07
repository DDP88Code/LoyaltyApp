$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$origin = "http://localhost:5173"
$headers = @{ Origin = $origin }
$password = "CoffeeBeans2026"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

function Assert-True([bool]$condition, [string]$message) {
	if (-not $condition) {
		throw $message
	}
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

function Register-Session([string]$name, [string]$email, [string]$passwordValue) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$body = @{ name = $name; email = $email; password = $passwordValue } | ConvertTo-Json -Compress
	$params = @{
		Method = "Post"
		Uri = "$origin/api/auth/sign-up/email"
		Headers = $headers
		ContentType = "application/json"
		Body = $body
		WebSession = $session
	}
	Invoke-RestMethod @params | Out-Null
	return $session
}

function Login-Session([string]$email, [string]$passwordValue) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$body = @{ email = $email; password = $passwordValue } | ConvertTo-Json -Compress
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

function SignOut-Session($session) {
	$params = @{
		Method = "Post"
		Uri = "$origin/api/auth/sign-out"
		Headers = $headers
		ContentType = "application/json"
		Body = "{}"
		WebSession = $session
	}
	Invoke-RestMethod @params | Out-Null
}

function Collect-Rewards($session) {
	$payload = Invoke-Json "Get" "/api/customer/rewards" $session
	$all = @()
	$all += $payload.data.available
	$all += $payload.data.redeemed
	$all += $payload.data.expired
	return ,$all
}

function Count-BirthdayRewards($session) {
	$all = Collect-Rewards $session
	$birthday = @($all | Where-Object {
		([string]$_.name -eq "Birthday Treat") -and ([string]$_.rewardType -eq "free_item")
	})
	return $birthday.Count
}

function Get-D1Count([string]$sql) {
	$result = npx wrangler d1 execute fives-rewards-db --local --command $sql --json | ConvertFrom-Json
	if ($result -isnot [System.Array]) {
		$result = @($result)
	}
	if ($result.Count -lt 1 -or $result[0].results.Count -lt 1) {
		throw "D1 query returned no rows: $sql"
	}
	return [int]$result[0].results[0].value
}

function Get-JohannesburgNow() {
	$tz = [System.TimeZoneInfo]::FindSystemTimeZoneById("South Africa Standard Time")
	return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz)
}

# Ensure baseline app data exists.
Invoke-Json "Post" "/api/dev/seed" (New-Object Microsoft.PowerShell.Commands.WebRequestSession) | Out-Null

$jhbNow = Get-JohannesburgNow
$todayIso = $jhbNow.ToString("yyyy-MM-dd")
$todayYear = $jhbNow.ToString("yyyy")

$email = "birthday.same-day.$stamp@example.test"
$session = Register-Session "Birthday Same Day" $email $password
$me = Invoke-Json "Get" "/api/me" $session
$customerId = [string]$me.data.user.id

Invoke-Json "Patch" "/api/customer/profile" $session @{ birthday = $todayIso } | Out-Null
Assert-True ((Count-BirthdayRewards $session) -eq 1) "Setting birthday today should issue one birthday reward"

# Reconcile on profile save must remain exactly-once for the same year.
Invoke-Json "Patch" "/api/customer/profile" $session @{ marketingOptIn = $true } | Out-Null
Assert-True ((Count-BirthdayRewards $session) -eq 1) "Profile updates on same day should not duplicate birthday rewards"

# Reconcile on login must also remain exactly-once.
SignOut-Session $session
$session = Login-Session $email $password
Assert-True ((Count-BirthdayRewards $session) -eq 1) "Sign-in reconciliation should not duplicate birthday rewards"

$todayIssuanceCount = Get-D1Count "SELECT COUNT(*) AS value FROM customer_rewards WHERE issuance_key = 'birthday:${customerId}:${todayYear}'"
Assert-True ($todayIssuanceCount -eq 1) "Birthday issuance key should exist exactly once for current year"

$leapEmail = "birthday.leap.$stamp@example.test"
$leapSession = Register-Session "Birthday Leap" $leapEmail $password
$leapMe = Invoke-Json "Get" "/api/me" $leapSession
$leapCustomerId = [string]$leapMe.data.user.id
Invoke-Json "Patch" "/api/customer/profile" $leapSession @{ birthday = "2000-02-29" } | Out-Null

# Non-leap year: Feb 29 birthdays should issue on Feb 28.
$firstRun = Invoke-Json "Post" "/api/dev/birthday/reconcile" (New-Object Microsoft.PowerShell.Commands.WebRequestSession) @{
	atIso = "2027-02-28T00:30:00+02:00"
}
Assert-True (([int]$firstRun.data.issued) -ge 1) "Expected at least one birthday issuance on non-leap Feb 28"

$leap2027Count = Get-D1Count "SELECT COUNT(*) AS value FROM customer_rewards WHERE issuance_key = 'birthday:${leapCustomerId}:2027'"
Assert-True ($leap2027Count -eq 1) "Leap-day customer should receive exactly one birthday reward in 2027"

# Re-running the same day should not reissue.
$secondRun = Invoke-Json "Post" "/api/dev/birthday/reconcile" (New-Object Microsoft.PowerShell.Commands.WebRequestSession) @{
	atIso = "2027-02-28T06:00:00+02:00"
}
$leap2027CountAfterRepeat = Get-D1Count "SELECT COUNT(*) AS value FROM customer_rewards WHERE issuance_key = 'birthday:${leapCustomerId}:2027'"
Assert-True ($leap2027CountAfterRepeat -eq 1) "Repeat reconcile on same date should not duplicate 2027 birthday reward"

# Leap year: should issue on Feb 29.
$thirdRun = Invoke-Json "Post" "/api/dev/birthday/reconcile" (New-Object Microsoft.PowerShell.Commands.WebRequestSession) @{
	atIso = "2028-02-29T00:30:00+02:00"
}
Assert-True (([int]$thirdRun.data.issued) -ge 1) "Expected birthday issuance on leap day"

$leap2028Count = Get-D1Count "SELECT COUNT(*) AS value FROM customer_rewards WHERE issuance_key = 'birthday:${leapCustomerId}:2028'"
Assert-True ($leap2028Count -eq 1) "Leap-day customer should receive exactly one birthday reward in 2028"

Write-Host "Birthday reward smoke passed."
