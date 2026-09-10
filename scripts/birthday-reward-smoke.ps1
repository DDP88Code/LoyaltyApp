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

function Get-HttpStatusCode([object]$errorRecord) {
	if ($null -eq $errorRecord) { return 0 }
	$exception = $errorRecord.Exception
	if ($null -eq $exception) { return 0 }
	if ($null -ne $exception.Response) {
		return [int]$exception.Response.StatusCode
	}
	return 0
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

function Ensure-AdminSession([string]$email, [string]$name, [string]$passwordValue) {
	try {
		Register-Session $name $email $passwordValue | Out-Null
	} catch {
		$status = Get-HttpStatusCode $_
		if ($status -ne 422) {
			throw
		}
	}

	$sql = "UPDATE profiles SET role='admin', active=1 WHERE email='$email'"
	npx wrangler d1 execute fives-rewards-db --local --command $sql | Out-Null

	return Login-Session $email $passwordValue
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

# Birthday must be read-only to the customer once set.
$birthdayChangeBlocked = $false
try {
	Invoke-Json "Patch" "/api/customer/profile" $session @{ birthday = "1990-01-01" } | Out-Null
} catch {
	$status = Get-HttpStatusCode $_
	if ($status -eq 409) {
		$birthdayChangeBlocked = $true
	} else {
		throw
	}
}
Assert-True $birthdayChangeBlocked "Customer must not be able to change an already-set birthday"

$meAfterBlockedEdit = Invoke-Json "Get" "/api/me" $session
Assert-True (([string]$meAfterBlockedEdit.data.user.birthday) -eq $todayIso) "Birthday must remain unchanged after a rejected customer edit"

# Admin/owner correction must be able to fix a birthday without ever duplicating this year's reward.
$adminEmail = "birthday.admin.$stamp@example.test"
$adminSession = Ensure-AdminSession $adminEmail "Birthday Admin" $password

Invoke-Json "Patch" "/api/admin/customers/$customerId/birthday" $adminSession @{ birthday = $todayIso } | Out-Null
Assert-True ((Count-BirthdayRewards $session) -eq 1) "Admin correction to the same date must not create a second birthday reward this year"

$correctedBirthday = "1995-05-05"
Invoke-Json "Patch" "/api/admin/customers/$customerId/birthday" $adminSession @{ birthday = $correctedBirthday } | Out-Null
$meAfterAdminFix = Invoke-Json "Get" "/api/me" $session
Assert-True (([string]$meAfterAdminFix.data.user.birthday) -eq $correctedBirthday) "Admin correction should update the stored birthday"
Assert-True ((Count-BirthdayRewards $session) -eq 1) "Admin correction to a different date must not create a second birthday reward this year"

$adminCorrectionAuditCount = Get-D1Count "SELECT COUNT(*) AS value FROM audit_logs WHERE action = 'admin.customer.birthday_corrected' AND entity_id = '$customerId'"
Assert-True ($adminCorrectionAuditCount -ge 2) "Each admin birthday correction must be audited"

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
