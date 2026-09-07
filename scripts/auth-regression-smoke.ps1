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
Assert-True ((Count-WelcomeRewards $session) -eq 1) "Recovery should issue one welcome reward exactly once"

# Partial-failure prevention/recovery: remove business rows locally, then sign up again.
npx wrangler d1 execute fives-rewards-db --local --command "DELETE FROM businesses" | Out-Null

$emailBootstrap = "auth.bootstrap.$stamp@example.test"
$bootstrapSession = Register-Session "Auth Bootstrap" $emailBootstrap $password (New-TurnstileToken)
$bootstrapMe = Invoke-Json "Get" "/api/me" $bootstrapSession
Assert-True ($bootstrapMe.data.user.email -eq $emailBootstrap) "Bootstrap signup user mismatch"
Assert-True ($bootstrapMe.data.user.role -eq "customer") "Bootstrap signup should produce customer role"
Assert-True ((Count-WelcomeRewards $bootstrapSession) -eq 1) "Bootstrap signup must issue one welcome reward"

Write-Host "Auth regression smoke passed."
