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

function Get-HttpErrorMessage([object]$errorRecord) {
	if ($null -eq $errorRecord) { return "" }
	$raw = $errorRecord.ErrorDetails.Message
	if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
	try {
		$parsed = $raw | ConvertFrom-Json
		if ($null -ne $parsed.error -and -not [string]::IsNullOrWhiteSpace([string]$parsed.error.message)) {
			return [string]$parsed.error.message
		}
		if (-not [string]::IsNullOrWhiteSpace([string]$parsed.message)) {
			return [string]$parsed.message
		}
	} catch {
		return $raw
	}
	return $raw
}

function Invoke-ExpectHttpFailure([ScriptBlock]$action) {
	$status = 0
	$message = ""
	try {
		& $action | Out-Null
	} catch {
		$status = Get-HttpStatusCode $_
		$message = Get-HttpErrorMessage $_
	}
	if ($status -eq 0) {
		throw "Expected HTTP failure but request succeeded"
	}
	return @{ status = $status; message = $message }
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

function Get-AppEnvironment() {
	$probeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$health = Invoke-Json "Get" "/api/health" $probeSession
	return [string]$health.data.environment
}

function Is-TurnstileProtectionActive() {
	$probeBody = @{ email = "turnstile.probe@example.test"; password = "WrongPassword!" } | ConvertTo-Json -Compress
	$status = 0
	try {
		Invoke-RestMethod -Method "Post" -Uri "$origin/api/auth/sign-in/email" -Headers $headers -ContentType "application/json" -Body $probeBody | Out-Null
	} catch {
		$status = Get-HttpStatusCode $_
	}
	return $status -eq 400
}

function New-TurnstileToken() {
	# Cloudflare's documented testing secret accepts synthetic tokens for local automation.
	return [guid]::NewGuid().ToString("N")
}

function New-TurnstileHeaders([string]$token) {
	$withTurnstile = @{}
	foreach ($entry in $headers.GetEnumerator()) {
		$withTurnstile[$entry.Key] = $entry.Value
	}
	$withTurnstile["cf-turnstile-response"] = $token
	return $withTurnstile
}

function Register-Session(
	[string]$name,
	[string]$email,
	[string]$passwordValue,
	[string]$turnstileToken = ""
) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$body = @{ name = $name; email = $email; password = $passwordValue } | ConvertTo-Json -Compress
	$requestHeaders = if ([string]::IsNullOrWhiteSpace($turnstileToken)) {
		$headers
	} else {
		New-TurnstileHeaders $turnstileToken
	}
	$params = @{
		Method = "Post"
		Uri = "$origin/api/auth/sign-up/email"
		Headers = $requestHeaders
		ContentType = "application/json"
		Body = $body
		WebSession = $session
	}
	Invoke-RestMethod @params | Out-Null
	return $session
}

function Login-Session(
	[string]$email,
	[string]$passwordValue,
	[string]$turnstileToken = ""
) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$body = @{ email = $email; password = $passwordValue } | ConvertTo-Json -Compress
	$requestHeaders = if ([string]::IsNullOrWhiteSpace($turnstileToken)) {
		$headers
	} else {
		New-TurnstileHeaders $turnstileToken
	}
	$params = @{
		Method = "Post"
		Uri = "$origin/api/auth/sign-in/email"
		Headers = $requestHeaders
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

function Count-WelcomeRewards($session) {
	$payload = Invoke-Json "Get" "/api/customer/rewards" $session
	$all = @()
	$all += $payload.data.available
	$all += $payload.data.redeemed
	$all += $payload.data.expired
	$welcome = @($all | Where-Object {
		$_.rewardType -eq "voucher" -and [int]$_.valueCents -eq 5000
	})
	return $welcome.Count
}

function Delete-Account($session) {
	return Invoke-Json "Delete" "/api/customer/account" $session
}

function Update-Profile($session, $payload) {
	return Invoke-Json "Patch" "/api/customer/profile" $session $payload
}

function Get-CustomerId($session) {
	$me = Invoke-Json "Get" "/api/me" $session
	return [string]$me.data.user.id
}

function Ensure-UserWithRole(
	[string]$email,
	[string]$name,
	[string]$role,
	[string]$passwordValue
) {
	try {
		Register-Session $name $email $passwordValue (New-TurnstileToken) | Out-Null
	} catch {
		$status = Get-HttpStatusCode $_
		if ($status -ne 422) {
			throw
		}
	}

	$sql = "UPDATE profiles SET role='$role', active=1 WHERE email='$email'"
	npx wrangler d1 execute fives-rewards-db --local --command $sql | Out-Null

	return Login-Session $email $passwordValue (New-TurnstileToken)
}

# Baseline development seed so all loyalty definitions/routes exist.
Invoke-Json "Post" "/api/dev/seed" (New-Object Microsoft.PowerShell.Commands.WebRequestSession) | Out-Null

$appEnvironment = Get-AppEnvironment
$turnstileProtected = Is-TurnstileProtectionActive
$turnstileInvalidToken = "invalid-turnstile-token"

if ($appEnvironment -eq "production") {
	Assert-True $turnstileProtected "Production must not allow auth without Turnstile protection"
}

$email = "auth.regression.$stamp@example.test"
$session = Register-Session "Auth Regression" $email $password (New-TurnstileToken)

if ($turnstileProtected) {
	$missingTurnstile = Invoke-ExpectHttpFailure {
		Register-Session "Auth Missing Turnstile" "auth.missing.$stamp@example.test" $password | Out-Null
	}
	Assert-True ($missingTurnstile.status -eq 400) "Missing Turnstile token should be rejected with HTTP 400"

	$invalidTurnstile = Invoke-ExpectHttpFailure {
		Register-Session "Auth Invalid Turnstile" "auth.invalid.$stamp@example.test" $password $turnstileInvalidToken | Out-Null
	}
	Assert-True ($invalidTurnstile.status -eq 400) "Invalid Turnstile token should be rejected with HTTP 400"

	$loginMissingTurnstile = Invoke-ExpectHttpFailure {
		Login-Session $email $password | Out-Null
	}
	Assert-True ($loginMissingTurnstile.status -eq 400) "Login without Turnstile token should be rejected with HTTP 400"

	$loginInvalidTurnstile = Invoke-ExpectHttpFailure {
		Login-Session $email $password $turnstileInvalidToken | Out-Null
	}
	Assert-True ($loginInvalidTurnstile.status -eq 400) "Login with invalid Turnstile token should be rejected with HTTP 400"

	$replayToken = New-TurnstileToken
	Register-Session "Auth Replay Seed" "auth.replay.seed.$stamp@example.test" $password $replayToken | Out-Null
	$replayTurnstile = Invoke-ExpectHttpFailure {
		Register-Session "Auth Replay Turnstile" "auth.replay.$stamp@example.test" $password $replayToken | Out-Null
	}
	Assert-True ($replayTurnstile.status -eq 400) "Replayed Turnstile token should be rejected with HTTP 400"
} else {
	Write-Host "Turnstile not enforced in this environment; skipping no-bypass assertions."
}

$me = Invoke-Json "Get" "/api/me" $session
Assert-True ($me.data.user.email -eq $email) "Registered user email mismatch"
Assert-True ($me.data.user.role -eq "customer") "Registered user must default to customer"
Assert-True ((Count-WelcomeRewards $session) -eq 1) "Welcome reward should be issued exactly once"

$duplicate = Invoke-ExpectHttpFailure {
	Register-Session "Auth Regression" $email $password (New-TurnstileToken) | Out-Null
}
Assert-True ($duplicate.status -eq 422) "Duplicate signup must return HTTP 422"
Assert-True (
	($duplicate.message -match "already exists") -or ($duplicate.message -match "exists"),
	"Duplicate signup should return a clear already-exists message"
)

SignOut-Session $session
$afterSignOut = Invoke-ExpectHttpFailure {
	Invoke-Json "Get" "/api/me" $session | Out-Null
}
Assert-True ($afterSignOut.status -eq 401) "Sign-out must clear session cookie"

$session = Login-Session $email $password (New-TurnstileToken)
$afterSignIn = Invoke-Json "Get" "/api/me" $session
Assert-True ($afterSignIn.data.user.email -eq $email) "Sign-in session did not persist"

# Missing-profile recovery: simulate an orphan auth account and verify /api/me heals it.
$deleteRewardsSql = "DELETE FROM customer_rewards WHERE customer_id IN (SELECT id FROM profiles WHERE email = '$email')"
$deleteProfileSql = "DELETE FROM profiles WHERE email = '$email'"
npx wrangler d1 execute fives-rewards-db --local --command $deleteRewardsSql | Out-Null
npx wrangler d1 execute fives-rewards-db --local --command $deleteProfileSql | Out-Null

$recoveredMe = Invoke-Json "Get" "/api/me" $session
Assert-True ($recoveredMe.data.user.email -eq $email) "Missing profile was not auto-reconciled"
Assert-True ($recoveredMe.data.user.role -eq "customer") "Recovered profile should remain customer"
Assert-True ((Count-WelcomeRewards $session) -eq 0) "Recovery must not reissue a welcome reward"

# Partial-failure prevention/recovery: remove business rows locally, then sign up again.
npx wrangler d1 execute fives-rewards-db --local --command "DELETE FROM businesses" | Out-Null

$emailBootstrap = "auth.bootstrap.$stamp@example.test"
$bootstrapSession = Register-Session "Auth Bootstrap" $emailBootstrap $password (New-TurnstileToken)
$bootstrapMe = Invoke-Json "Get" "/api/me" $bootstrapSession
Assert-True ($bootstrapMe.data.user.email -eq $emailBootstrap) "Bootstrap signup user mismatch"
Assert-True ($bootstrapMe.data.user.role -eq "customer") "Bootstrap signup should produce customer role"
Assert-True ((Count-WelcomeRewards $bootstrapSession) -eq 1) "Bootstrap signup must issue one welcome reward"

# Welcome claim anti-abuse: same email after account deletion should not get another welcome reward.
$repeatEmail = "auth.repeat.$stamp@example.test"
$repeatSession = Register-Session "Auth Repeat" $repeatEmail $password (New-TurnstileToken)
Assert-True ((Count-WelcomeRewards $repeatSession) -eq 1) "First registration should receive one welcome reward"
$repeatDelete = Delete-Account $repeatSession
Assert-True ($repeatDelete.data.deleted -eq $true) "Repeat test account deletion failed"
$repeatRejoin = Register-Session "Auth Repeat" $repeatEmail $password (New-TurnstileToken)
Assert-True ((Count-WelcomeRewards $repeatRejoin) -eq 0) "Same email must not receive another welcome reward after deletion"

# Welcome claim anti-abuse: known mobile marker should block a later welcome issuance attempt.
$mobileShared = "082" + (($stamp % 10000000).ToString().PadLeft(7, "0"))
$mobileSourceEmail = "auth.mobile.source.$stamp@example.test"
$mobileSourceSession = Register-Session "Auth Mobile Source" $mobileSourceEmail $password (New-TurnstileToken)
Assert-True ((Count-WelcomeRewards $mobileSourceSession) -eq 1) "Mobile source should receive one welcome reward"
Update-Profile $mobileSourceSession @{ mobileNumber = $mobileShared } | Out-Null
$mobileSourceDelete = Delete-Account $mobileSourceSession
Assert-True ($mobileSourceDelete.data.deleted -eq $true) "Mobile source deletion failed"

$mobileReplayEmail = "auth.mobile.replay.$stamp@example.test"
$mobileReplaySession = Register-Session "Auth Mobile Replay" $mobileReplayEmail $password (New-TurnstileToken)
Update-Profile $mobileReplaySession @{ mobileNumber = $mobileShared } | Out-Null
$mobileReplayCustomerId = Get-CustomerId $mobileReplaySession
$removeReplayWelcomeSql = "DELETE FROM customer_rewards WHERE customer_id = '$mobileReplayCustomerId' AND reward_definition_id IN (SELECT id FROM reward_definitions WHERE welcome_reward = 1)"
npx wrangler d1 execute fives-rewards-db --local --command $removeReplayWelcomeSql | Out-Null
SignOut-Session $mobileReplaySession
$mobileReplaySession = Login-Session $mobileReplayEmail $password (New-TurnstileToken)
Assert-True ((Count-WelcomeRewards $mobileReplaySession) -eq 0) "Different email with a previously claimed known mobile must not receive a welcome reward"

# Unrelated new customer should still receive one welcome reward.
$unrelatedEmail = "auth.unrelated.$stamp@example.test"
$unrelatedSession = Register-Session "Auth Unrelated" $unrelatedEmail $password (New-TurnstileToken)
Assert-True ((Count-WelcomeRewards $unrelatedSession) -eq 1) "Unrelated new customer should receive one welcome reward"

# Normal account deletion behavior should remain intact.
$deleteOnlyEmail = "auth.delete.only.$stamp@example.test"
$deleteOnlySession = Register-Session "Auth Delete" $deleteOnlyEmail $password (New-TurnstileToken)
$deleteOnlyResult = Delete-Account $deleteOnlySession
Assert-True ($deleteOnlyResult.data.deleted -eq $true) "Normal account deletion should still succeed"
$afterDeleteOnly = Invoke-ExpectHttpFailure {
	Invoke-Json "Get" "/api/me" $deleteOnlySession | Out-Null
}
Assert-True ($afterDeleteOnly.status -eq 401) "Deleted account session should no longer be valid"

# Admin manual adjustment path should remain possible.
$adminEmail = "auth.manual.admin.$stamp@example.test"
$adminSession = Ensure-UserWithRole $adminEmail "Auth Manual Admin" "admin" $password
$manualTargetId = Get-CustomerId $unrelatedSession
$programs = Invoke-Json "Get" "/api/admin/loyalty/programs" $adminSession
$coffeeProgram = $null
foreach ($program in $programs.data.programs) {
	if ([string]$program.currencyCode -eq "COFFEE") {
		$coffeeProgram = $program
		break
	}
}
Assert-True ($null -ne $coffeeProgram) "Manual grant test could not find coffee program"
$staffContext = Invoke-Json "Get" "/api/staff/context" $adminSession
Assert-True ($staffContext.data.locations.Count -gt 0) "Manual grant test could not find a location"
$locationId = [string]$staffContext.data.locations[0].id
$adjustment = Invoke-Json "Post" "/api/admin/customers/$manualTargetId/adjustments" $adminSession @{
	programId = [string]$coffeeProgram.id
	locationId = $locationId
	transactionType = "adjustment"
	quantity = 1
	reason = "Welcome claim anti-abuse regression check"
	billReference = "AUTH-MANUAL-$stamp"
	idempotencyKey = "auth-manual-$stamp"
}
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$adjustment.data.transactionId)) "Admin manual adjustment should still be possible"

Write-Host "Auth regression smoke passed."
