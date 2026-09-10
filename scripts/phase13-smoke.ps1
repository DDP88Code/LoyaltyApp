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

function Register-Session(
	[string]$name,
	[string]$email,
	[string]$passwordValue,
	[hashtable]$extra = $null
) {
	$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
	$bodyObject = @{ name = $name; email = $email; password = $passwordValue }
	if ($null -ne $extra) {
		foreach ($key in $extra.Keys) {
			$bodyObject[$key] = $extra[$key]
		}
	}
	$body = $bodyObject | ConvertTo-Json -Compress
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
		$code = Get-HttpStatusCode $_
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

function Get-D1FirstRow([string]$sql) {
	$result = npx wrangler d1 execute fives-rewards-db --local --command $sql --json | ConvertFrom-Json
	if ($result -isnot [System.Array]) {
		$result = @($result)
	}
	if ($result.Count -lt 1 -or $result[0].results.Count -lt 1) {
		throw "D1 query returned no rows: $sql"
	}
	return $result[0].results[0]
}

function Get-D1Count([string]$sql) {
	$row = Get-D1FirstRow $sql
	return [int]$row.value
}

function Get-SeedEntityCount(
	$seedPayload,
	[string]$bucket,
	[string]$entity
) {
	if ($null -eq $seedPayload) { return 0 }
	$bucketValue = $seedPayload.$bucket
	if ($null -eq $bucketValue) { return 0 }
	$property = $bucketValue.PSObject.Properties[$entity]
	if ($null -eq $property) { return 0 }
	return [int]$property.Value
}

function Get-FreeCoffeeRewardCount([string]$businessId, [string]$customerId) {
	return Get-D1Count "SELECT COUNT(*) as value FROM customer_rewards cr INNER JOIN reward_definitions rd ON rd.id = cr.reward_definition_id WHERE cr.business_id = '$businessId' AND cr.customer_id = '$customerId' AND rd.reward_type = 'free_item' AND rd.item_reference = 'COFFEE'"
}

function Get-RewardEarnedNotificationCount(
	[string]$businessId,
	[string]$customerId,
	[string]$rewardId
) {
	return Get-D1Count "SELECT COUNT(*) as value FROM notifications WHERE business_id = '$businessId' AND customer_id = '$customerId' AND type = 'reward_earned' AND source_type = 'reward_issue' AND source_id = '$rewardId'"
}

function Ensure-UserWithRole(
	[string]$email,
	[string]$name,
	[string]$role,
	[string]$passwordValue
) {
	$created = $false
	try {
		Login-Session $email $passwordValue | Out-Null
	} catch {
		$created = $true
	}

	if ($created) {
		Register-Session $name $email $passwordValue | Out-Null
	}

	$sql = "UPDATE profiles SET role='$role', active=1 WHERE email='$email'"
	npx wrangler d1 execute fives-rewards-db --local --command $sql | Out-Null

	return Login-Session $email $passwordValue
}

function Get-CustomerId($session) {
	$me = Invoke-Json "Get" "/api/me" $session
	return [string]$me.data.user.id
}

function New-TestMobile([long]$seed) {
	$digits = ([Math]::Abs($seed) % 100000000).ToString().PadLeft(8, "0")
	return "06$digits"
}

function Find-StaffIdByEmail($adminSession, [string]$email) {
	$encoded = [Uri]::EscapeDataString($email)
	$list = Invoke-Json "Get" "/api/admin/staff?search=$encoded&limit=50&offset=0" $adminSession
	foreach ($member in $list.data.staff) {
		if ([string]$member.email -eq $email) {
			return [string]$member.id
		}
	}
	throw "Staff profile for $email not found"
}

function Collect-CustomerRewards($session) {
	$payload = Invoke-Json "Get" "/api/customer/rewards" $session
	$all = @()
	$all += $payload.data.available
	$all += $payload.data.redeemed
	$all += $payload.data.expired
	return ,$all
}

function Resolve-ByOtp($staffSession, [string]$otp) {
	return Invoke-Json "Post" "/api/staff/loyalty-code/resolve" $staffSession @{ otp = $otp }
}

function Resolve-ByQr($staffSession, [string]$qrToken) {
	return Invoke-Json "Post" "/api/staff/loyalty-code/resolve" $staffSession @{ qrToken = $qrToken }
}

$seedOne = Invoke-Json "Post" "/api/dev/seed" (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
$businessId = [string]$seedOne.data.businessId

Assert-True (-not [string]::IsNullOrWhiteSpace($businessId)) "Seed did not return business id"

$coffeeProgramAfterFirstSeed = Get-D1FirstRow "SELECT lp.qualifying_purchases_required as threshold FROM loyalty_programs lp WHERE lp.business_id = '$businessId' AND lp.currency_code = 'COFFEE' LIMIT 1"
$thresholdAfterFirstSeed = [int]$coffeeProgramAfterFirstSeed.threshold

$seedTwo = Invoke-Json "Post" "/api/dev/seed" (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
Assert-True ($businessId -eq [string]$seedTwo.data.businessId) "Seed business id changed between runs"

$businessCount = Get-D1Count "SELECT COUNT(*) as value FROM businesses WHERE id = '$businessId'"
$locationCount = Get-D1Count "SELECT COUNT(*) as value FROM locations WHERE business_id = '$businessId' AND name = 'Fives - Pinehurst'"
$welcomeRewardCount = Get-D1Count "SELECT COUNT(*) as value FROM reward_definitions WHERE business_id = '$businessId' AND welcome_reward = 1"
$freeCoffeeCount = Get-D1Count "SELECT COUNT(*) as value FROM reward_definitions WHERE business_id = '$businessId' AND name = 'Free Coffee'"
$coffeeProgramCount = Get-D1Count "SELECT COUNT(*) as value FROM loyalty_programs WHERE business_id = '$businessId' AND currency_code = 'COFFEE'"

Assert-True ($businessCount -eq 1) "Expected exactly one business row"
Assert-True ($locationCount -eq 1) "Expected exactly one default location"
Assert-True ($welcomeRewardCount -eq 1) "Expected exactly one welcome reward definition"
Assert-True ($freeCoffeeCount -eq 1) "Expected exactly one Free Coffee reward definition"
Assert-True ($coffeeProgramCount -eq 1) "Expected exactly one coffee loyalty program"

$coffeeProgramRow = Get-D1FirstRow "SELECT lp.qualifying_purchases_required as threshold, rd.name as rewardName FROM loyalty_programs lp LEFT JOIN reward_definitions rd ON rd.id = lp.reward_definition_id WHERE lp.business_id = '$businessId' AND lp.currency_code = 'COFFEE' LIMIT 1"
$thresholdAfterSecondSeed = [int]$coffeeProgramRow.threshold

$coffeeProgramsCreatedInSeedOne = Get-SeedEntityCount $seedOne.data "created" "loyalty_programs"
if ($coffeeProgramsCreatedInSeedOne -gt 0) {
	Assert-True ($thresholdAfterSecondSeed -eq 10) "Default coffee threshold should start at 10 when program is first created"
} else {
	Assert-True ($thresholdAfterSecondSeed -eq $thresholdAfterFirstSeed) "Seed reconciliation should preserve existing coffee threshold"
}

Assert-True (([string]$coffeeProgramRow.rewardName) -eq "Free Coffee") "Coffee program should reference Free Coffee"

$adminEmail = "phase13.admin.$stamp@example.test"
$adminSession = Ensure-UserWithRole $adminEmail "Admin User" "admin" $password
$staffEmail = "phase13.staff.$stamp@example.test"
$staffSession = Ensure-UserWithRole $staffEmail "Phase13 Staff" "staff" $password

$journeyEmail = "phase13.journey.$stamp@example.test"
$otherEmail = "phase13.other.$stamp@example.test"
$escalationEmail = "phase13.escalate.$stamp@example.test"

$journeySession = Register-Session "Phase13 Journey" $journeyEmail $password
$otherSession = Register-Session "Phase13 Other" $otherEmail $password

$escalationBlocked = $false
$escalationSession = $null
try {
	$escalationSession = Register-Session "Phase13 Escalation" $escalationEmail $password @{ role = "admin" }
} catch {
	$code = Get-HttpStatusCode $_
	if ($code -ge 400) {
		$escalationBlocked = $true
	} else {
		throw
	}
}

if (-not $escalationBlocked) {
	$escalationMe = Invoke-Json "Get" "/api/me" $escalationSession
	Assert-True ($escalationMe.data.user.role -eq "customer") "Client role escalation was not blocked"
}

$journeyCustomerId = Get-CustomerId $journeySession
$otherCustomerId = Get-CustomerId $otherSession

# Welcome reward is deferred until mobile exists; save it now so the journey
# customer has their welcome voucher available for the checks further below.
Invoke-Json "Patch" "/api/customer/profile" $journeySession @{ mobileNumber = (New-TestMobile $stamp) } | Out-Null

$dashboard = Invoke-Json "Get" "/api/admin/dashboard?days=30" $adminSession
$expectedTotalMembers = Get-D1Count "SELECT COUNT(*) as value FROM profiles WHERE business_id = '$businessId' AND role = 'customer'"
$expectedActiveMembers = Get-D1Count "SELECT COUNT(*) as value FROM profiles WHERE business_id = '$businessId' AND role = 'customer' AND active = 1"
$expectedNewMembersThisMonth = Get-D1Count "SELECT COUNT(*) as value FROM profiles WHERE business_id = '$businessId' AND role = 'customer' AND strftime('%Y-%m', created_at / 1000, 'unixepoch') = strftime('%Y-%m', 'now')"
$expectedOutstandingRewards = Get-D1Count "SELECT COUNT(*) as value FROM customer_rewards WHERE business_id = '$businessId' AND status = 'available'"

Assert-True (([int]$dashboard.data.metrics.totalMembers) -eq $expectedTotalMembers) "Dashboard total members does not match customer-role count"
Assert-True (([int]$dashboard.data.metrics.activeMembers) -eq $expectedActiveMembers) "Dashboard active members does not match active customer-role count"
Assert-True (([int]$dashboard.data.metrics.newMembersThisMonth) -eq $expectedNewMembersThisMonth) "Dashboard new members does not match monthly customer-role count"
Assert-True (([int]$dashboard.data.metrics.outstandingRewards) -eq $expectedOutstandingRewards) "Dashboard outstanding rewards does not match available rewards count"

$staffContext = Invoke-Json "Get" "/api/staff/context" $staffSession
Assert-True ($staffContext.data.locations.Count -gt 0) "No staff location available"
$locationId = [string]$staffContext.data.locations[0].id

$staffId = Find-StaffIdByEmail $adminSession $staffEmail

$loyaltyPrograms = Invoke-Json "Get" "/api/admin/loyalty/programs" $adminSession
$coffeeProgram = $null
foreach ($program in $loyaltyPrograms.data.programs) {
	if ([string]$program.currencyCode -eq "COFFEE") {
		$coffeeProgram = $program
		break
	}
}
Assert-True ($null -ne $coffeeProgram) "Coffee program not found"
$coffeeProgramId = [string]$coffeeProgram.id

Invoke-Json "Patch" "/api/admin/loyalty/programs/$coffeeProgramId" $adminSession @{
	qualifyingPurchasesRequired = 3
	active = $true
} | Out-Null

# Focused reward consistency checks
$staffThresholdEmail = "phase13.staff-threshold.$stamp@example.test"
$staffThresholdSession = Register-Session "Phase13 Staff Threshold" $staffThresholdEmail $password
$staffThresholdCustomerId = Get-CustomerId $staffThresholdSession

npx wrangler d1 execute fives-rewards-db --local --command "UPDATE profiles SET notification_opt_in = 1 WHERE id = '$staffThresholdCustomerId'" | Out-Null

$staffPushConfig = Invoke-Json "Get" "/api/customer/push/config" $staffThresholdSession
if ($staffPushConfig.data.configured) {
	Invoke-Json "Post" "/api/customer/push/subscriptions" $staffThresholdSession @{
		endpoint = "https://example.invalid/phase13/$stamp"
		p256dhKey = "BOr6nVb8GxH0xH8gH1J2uR7V8vH3mN0qvVYv5E0aB6jzJxv4eM0bYv2J8fQ2lG8t7U9rS6wX3yZ1aB2cD4eF5g"
		authKey = "dGVzdC1ub3QtYS1yZWFsLWF1dGg"
		deviceLabel = "Phase13 invalid push"
	} | Out-Null
}

$staffPrefill = Invoke-Json "Post" "/api/staff/customers/$staffThresholdCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 2
	billReference = "PH13-STAFF-PREFILL"
	idempotencyKey = "phase13-staff-prefill-$stamp"
}
Assert-True (($staffPrefill.data.newlyIssuedCount -eq 0)) "Staff prefill should not issue a reward before threshold"

$staffFinalIdempotency = "phase13-staff-final-$stamp"
$staffFinal = Invoke-Json "Post" "/api/staff/customers/$staffThresholdCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 1
	billReference = "PH13-STAFF-FINAL"
	idempotencyKey = $staffFinalIdempotency
}
Assert-True (($staffFinal.data.newlyIssuedCount -eq 1)) "Staff final coffee should issue exactly one reward"

$staffFreeRewards = @($staffFinal.data.availableFreeCoffees)
Assert-True ($staffFreeRewards.Count -eq 1) "Staff final coffee should expose exactly one available free coffee"
$staffRewardId = [string]$staffFreeRewards[0].id

$staffRewardCount = Get-FreeCoffeeRewardCount $businessId $staffThresholdCustomerId
Assert-True ($staffRewardCount -eq 1) "Staff final coffee should persist exactly one free coffee reward"

$staffNotificationCount = Get-RewardEarnedNotificationCount $businessId $staffThresholdCustomerId $staffRewardId
Assert-True ($staffNotificationCount -eq 1) "Staff final coffee reward should create one reward notification"

$staffNotification = Get-D1FirstRow "SELECT title, message, push_sent_at as pushSentAt FROM notifications WHERE business_id = '$businessId' AND customer_id = '$staffThresholdCustomerId' AND type = 'reward_earned' AND source_type = 'reward_issue' AND source_id = '$staffRewardId' LIMIT 1"
$title = ([string]$staffNotification.title).Trim()
$message = ([string]$staffNotification.message).Trim()
Assert-True (($title.StartsWith("Free Coffee Unlocked"))) "Reward notification title mismatch"
Assert-True (($message -eq "Your next coffee is on us.")) "Reward notification message mismatch"

if ($staffPushConfig.data.configured) {
	Assert-True ($null -eq $staffNotification.pushSentAt) "Push failure should not block reward issuance"
} else {
	Write-Output "Web push not configured in local smoke environment; push-failure assertion skipped."
}

$staffFinalDuplicate = Invoke-Json "Post" "/api/staff/customers/$staffThresholdCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 1
	billReference = "PH13-STAFF-FINAL"
	idempotencyKey = $staffFinalIdempotency
}
Assert-True (($staffFinalDuplicate.data.newlyIssuedCount -eq 0)) "Duplicate staff final coffee should not issue a second reward"
Assert-True ((Get-FreeCoffeeRewardCount $businessId $staffThresholdCustomerId) -eq 1) "Duplicate staff earn should not create extra rewards"
Assert-True ((Get-RewardEarnedNotificationCount $businessId $staffThresholdCustomerId $staffRewardId) -eq 1) "Duplicate staff earn should not create extra notifications"

$adminAdjustmentEmail = "phase13.admin-adjust.$stamp@example.test"
$adminAdjustmentSession = Register-Session "Phase13 Admin Adjust" $adminAdjustmentEmail $password
$adminAdjustmentCustomerId = Get-CustomerId $adminAdjustmentSession

Invoke-Json "Post" "/api/staff/customers/$adminAdjustmentCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 2
	billReference = "PH13-ADMIN-PREFILL"
	idempotencyKey = "phase13-admin-prefill-$stamp"
} | Out-Null

$adminAdjustmentIdempotency = "phase13-admin-adjust-$stamp"
$adminAdjustment = Invoke-Json "Post" "/api/admin/customers/$adminAdjustmentCustomerId/adjustments" $adminSession @{
	programId = $coffeeProgramId
	locationId = $locationId
	transactionType = "adjustment"
	quantity = 1
	reason = "Phase 13 threshold consistency check"
	billReference = "PH13-ADMIN-ADJUST"
	idempotencyKey = $adminAdjustmentIdempotency
}
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$adminAdjustment.data.transactionId)) "Admin adjustment should create a transaction"
Assert-True ((Get-FreeCoffeeRewardCount $businessId $adminAdjustmentCustomerId) -eq 1) "Positive admin adjustment crossing threshold should issue one reward"

$adminRewardRow = Get-D1FirstRow "SELECT cr.id as rewardId FROM customer_rewards cr INNER JOIN reward_definitions rd ON rd.id = cr.reward_definition_id WHERE cr.business_id = '$businessId' AND cr.customer_id = '$adminAdjustmentCustomerId' AND rd.reward_type = 'free_item' AND rd.item_reference = 'COFFEE' ORDER BY cr.issued_at DESC LIMIT 1"
$adminRewardId = [string]$adminRewardRow.rewardId
Assert-True ((Get-RewardEarnedNotificationCount $businessId $adminAdjustmentCustomerId $adminRewardId) -eq 1) "Admin threshold reward should create one reward notification"

$adminAdjustmentDuplicate = Invoke-Json "Post" "/api/admin/customers/$adminAdjustmentCustomerId/adjustments" $adminSession @{
	programId = $coffeeProgramId
	locationId = $locationId
	transactionType = "adjustment"
	quantity = 1
	reason = "Phase 13 threshold consistency check"
	billReference = "PH13-ADMIN-ADJUST"
	idempotencyKey = $adminAdjustmentIdempotency
}
Assert-True (([string]$adminAdjustmentDuplicate.data.transactionId -eq [string]$adminAdjustment.data.transactionId)) "Duplicate admin adjustment should return the original transaction"
Assert-True ((Get-FreeCoffeeRewardCount $businessId $adminAdjustmentCustomerId) -eq 1) "Duplicate admin adjustment should not issue extra rewards"
Assert-True ((Get-RewardEarnedNotificationCount $businessId $adminAdjustmentCustomerId $adminRewardId) -eq 1) "Duplicate admin adjustment should not create extra notifications"

$negativeAdjustmentEmail = "phase13.negative-adjust.$stamp@example.test"
$negativeAdjustmentSession = Register-Session "Phase13 Negative Adjust" $negativeAdjustmentEmail $password
$negativeAdjustmentCustomerId = Get-CustomerId $negativeAdjustmentSession

Invoke-Json "Post" "/api/admin/customers/$negativeAdjustmentCustomerId/adjustments" $adminSession @{
	programId = $coffeeProgramId
	locationId = $locationId
	transactionType = "reversal"
	quantity = -1
	reason = "Phase 13 negative adjustment check"
	billReference = "PH13-NEG-ADJUST"
	idempotencyKey = "phase13-neg-adjust-$stamp"
} | Out-Null

Assert-True ((Get-FreeCoffeeRewardCount $businessId $negativeAdjustmentCustomerId) -eq 0) "Negative adjustment must not issue rewards"
$negativeNotificationCount = Get-D1Count "SELECT COUNT(*) as value FROM notifications WHERE business_id = '$businessId' AND customer_id = '$negativeAdjustmentCustomerId' AND type = 'reward_earned'"
Assert-True ($negativeNotificationCount -eq 0) "Negative adjustment must not create reward notifications"

# Security checks
$journeyAvailable = Collect-CustomerRewards $journeySession | Where-Object { $_.status -eq "available" }
Assert-True ($journeyAvailable.Count -gt 0) "Journey customer should have at least one available reward"
$journeyRewardId = [string]$journeyAvailable[0].id

Expect-HttpStatus {
	Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/coffee" $journeySession @{
		locationId = $locationId
		quantity = 1
		billReference = "PH13-FORBID-EARN"
		idempotencyKey = "phase13-forbid-earn-$stamp"
	}
} 403

Expect-HttpStatus {
	Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/rewards/$journeyRewardId/redeem" $journeySession @{
		locationId = $locationId
		billReference = "PH13-FORBID-REDEEM"
	}
} 403

Expect-HttpStatus {
	Invoke-Json "Get" "/api/admin/customers/$otherCustomerId" $journeySession
} 403

Expect-HttpStatus {
	Invoke-Json "Get" "/api/admin/dashboard" $staffSession
} 403

$inactivePatch = Invoke-Json "Patch" "/api/admin/staff/$staffId" $adminSession @{ active = $false }
Assert-True ($inactivePatch.data.updated -eq $true) "Failed to deactivate staff user"

Expect-HttpStatus {
	Invoke-Json "Get" "/api/staff/context" $staffSession
} 403

Invoke-Json "Patch" "/api/admin/staff/$staffId" $adminSession @{ active = $true } | Out-Null
$staffSession = Login-Session $staffEmail $password

Expect-HttpStatus {
	Invoke-Json "Get" "/api/customer/home" (New-Object Microsoft.PowerShell.Commands.WebRequestSession)
} 401

# Codes checks
$validCode = Invoke-Json "Post" "/api/customer/loyalty-code" $journeySession
$validOtpResult = Resolve-ByOtp $staffSession ([string]$validCode.data.otp)
Assert-True (($validOtpResult.data.customerId -eq $journeyCustomerId)) "Valid OTP failed"

$invalidOtp = "999999"
if ($invalidOtp -eq [string]$validCode.data.otp) { $invalidOtp = "111111" }
Expect-HttpStatus {
	Resolve-ByOtp $staffSession $invalidOtp
} 400

$validQrCode = Invoke-Json "Post" "/api/customer/loyalty-code" $journeySession
$validQrResult = Resolve-ByQr $staffSession ([string]$validQrCode.data.qrToken)
Assert-True (($validQrResult.data.customerId -eq $journeyCustomerId)) "Valid QR failed"

Expect-HttpStatus {
	Resolve-ByQr $staffSession "invalid-phase13-qr-token"
} 400

$oldCode = Invoke-Json "Post" "/api/customer/loyalty-code" $journeySession
$newCode = Invoke-Json "Post" "/api/customer/loyalty-code" $journeySession
Expect-HttpStatus {
	Resolve-ByOtp $staffSession ([string]$oldCode.data.otp)
} 400
$newResolve = Resolve-ByOtp $staffSession ([string]$newCode.data.otp)
Assert-True (($newResolve.data.customerId -eq $journeyCustomerId)) "New code should remain valid"

$expiringCode = Invoke-Json "Post" "/api/customer/loyalty-code" $journeySession
$expireSql = "UPDATE loyalty_codes SET expires_at = (strftime('%s','now') * 1000 - 60000) WHERE customer_id = '$journeyCustomerId' AND used_at IS NULL"
npx wrangler d1 execute fives-rewards-db --local --command $expireSql | Out-Null
Expect-HttpStatus {
	Resolve-ByOtp $staffSession ([string]$expiringCode.data.otp)
} 400

# Loyalty + full journey + race checks
$homeBefore = Invoke-Json "Get" "/api/customer/home" $journeySession
$beforeCurrent = [int]$homeBefore.data.coffee.current

$earnRef1 = "PH13-EARN-$stamp-1"
$idem1 = "phase13-earn-$stamp-1"
$earn1 = Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 1
	billReference = $earnRef1
	idempotencyKey = $idem1
}
Assert-True (($earn1.data.customerId -eq $journeyCustomerId)) "Staff add coffee failed"
Assert-True (($earn1.data.coffee.current -ge $beforeCurrent)) "Coffee progress did not update"

$earn1Dup = Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 1
	billReference = $earnRef1
	idempotencyKey = $idem1
}
Assert-True (($earn1Dup.data.coffee.current -eq $earn1.data.coffee.current)) "Duplicate earn changed progress"
Assert-True (($earn1Dup.data.newlyIssuedCount -eq 0)) "Duplicate earn issued rewards"

$earnRef2 = "PH13-EARN-$stamp-2"
$idem2 = "phase13-earn-$stamp-2"
$earn2 = Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 6
	billReference = $earnRef2
	idempotencyKey = $idem2
}
Assert-True (($earn2.data.newlyIssuedCount -ge 2)) "Multiple cycles did not issue expected rewards"

$earn2Dup = Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/coffee" $staffSession @{
	locationId = $locationId
	quantity = 6
	billReference = $earnRef2
	idempotencyKey = $idem2
}
Assert-True (($earn2Dup.data.newlyIssuedCount -eq 0)) "Duplicate multi-cycle earn issued duplicate rewards"

$homeAfterEarn = Invoke-Json "Get" "/api/customer/home" $journeySession
Assert-True (($homeAfterEarn.data.coffee.current -ne $beforeCurrent)) "Customer progress did not change after earn"

$freeRewards = @($earn2.data.availableFreeCoffees)
Assert-True ($freeRewards.Count -gt 0) "Free coffee reward did not appear at threshold"
$freeRewardId = [string]$freeRewards[0].id

$redeemRef = "PH13-REDEEM-$stamp"
$redeem1 = Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/rewards/$freeRewardId/redeem" $staffSession @{
	locationId = $locationId
	billReference = $redeemRef
}
Assert-True (($redeem1.data.customerId -eq $journeyCustomerId)) "Redeem failed"

Expect-HttpStatus {
	Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/rewards/$freeRewardId/redeem" $staffSession @{
		locationId = $locationId
		billReference = "$redeemRef-DUP"
	}
} 409

$allRewards = Collect-CustomerRewards $journeySession
$welcomeRewards = @($allRewards | Where-Object {
	$_.rewardType -eq "voucher" -and $_.valueCents -eq 5000
})
Assert-True ($welcomeRewards.Count -eq 1) "Welcome reward should exist exactly once"

$welcomeRewardId = [string]$welcomeRewards[0].id
$expireRewardSql = "UPDATE customer_rewards SET expires_at = (strftime('%s','now') * 1000 - 60000), status = 'available', redeemed_at = NULL, redeemed_by = NULL, redemption_transaction_id = NULL WHERE id = '$welcomeRewardId'"
npx wrangler d1 execute fives-rewards-db --local --command $expireRewardSql | Out-Null

Expect-HttpStatus {
	Invoke-Json "Post" "/api/staff/customers/$journeyCustomerId/rewards/$welcomeRewardId/redeem" $staffSession @{
		locationId = $locationId
		billReference = "PH13-EXPIRED"
	}
} 409

$adjustmentIdKey = "phase13-adjustment-$stamp"
$adjustment = Invoke-Json "Post" "/api/admin/customers/$journeyCustomerId/adjustments" $adminSession @{
	programId = $coffeeProgramId
	locationId = $locationId
	transactionType = "adjustment"
	quantity = 2
	reason = "Phase 13 adjustment audit validation"
	billReference = "PH13-ADJUST"
	idempotencyKey = $adjustmentIdKey
}
$adjustmentTransactionId = [string]$adjustment.data.transactionId
Assert-True (-not [string]::IsNullOrWhiteSpace($adjustmentTransactionId)) "Adjustment transaction id missing"

$reversal = Invoke-Json "Post" "/api/admin/customers/$journeyCustomerId/adjustments" $adminSession @{
	programId = $coffeeProgramId
	locationId = $locationId
	transactionType = "reversal"
	quantity = -1
	reason = "Phase 13 reversal validation"
	billReference = "PH13-REVERSAL"
	idempotencyKey = "phase13-reversal-$stamp"
}
$reversalTransactionId = [string]$reversal.data.transactionId
Assert-True (-not [string]::IsNullOrWhiteSpace($reversalTransactionId)) "Reversal transaction id missing"

$auditForAdjustment = Invoke-Json "Get" "/api/admin/audit?action=admin.loyalty_adjustment&entityId=$adjustmentTransactionId&limit=20&offset=0" $adminSession
Assert-True ($auditForAdjustment.data.entries.Count -ge 1) "Adjustment audit entry missing"

$transactions = Invoke-Json "Get" "/api/admin/transactions?customerId=$journeyCustomerId&limit=100&offset=0" $adminSession
$earnTx = $null
$redeemTx = $null
$reversalTx = $null

foreach ($tx in $transactions.data.transactions) {
	if (($null -eq $earnTx) -and ([string]$tx.billReference -eq $earnRef2) -and ([string]$tx.transactionType -eq "earn")) {
		$earnTx = $tx
	}
	if (($null -eq $redeemTx) -and ([string]$tx.billReference -eq $redeemRef) -and ([string]$tx.transactionType -eq "redeem")) {
		$redeemTx = $tx
	}
	if (($null -eq $reversalTx) -and ([string]$tx.id -eq $reversalTransactionId) -and ([string]$tx.transactionType -eq "reversal")) {
		$reversalTx = $tx
	}
}

Assert-True ($null -ne $earnTx) "Earn transaction trace missing"
Assert-True ($null -ne $redeemTx) "Redeem transaction trace missing"
Assert-True ($null -ne $reversalTx) "Reversal transaction missing"

Assert-True (($earnTx.customerId -eq $journeyCustomerId)) "Earn customer mismatch"
Assert-True (($redeemTx.customerId -eq $journeyCustomerId)) "Redeem customer mismatch"
Assert-True (($earnTx.locationId -eq $locationId)) "Earn location mismatch"
Assert-True (($redeemTx.locationId -eq $locationId)) "Redeem location mismatch"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.staffId)) "Earn staff missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.staffId)) "Redeem staff missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.createdAt)) "Earn timestamp missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.createdAt)) "Redeem timestamp missing"

$customerDetail = Invoke-Json "Get" "/api/admin/customers/$journeyCustomerId" $adminSession
Assert-True (($customerDetail.data.transactions.Count -gt 0)) "Admin customer detail missing transactions"

Write-Output "Phase 13 smoke checks passed"
Write-Output "journeyCustomerId=$journeyCustomerId staffId=$staffId coffeeProgramId=$coffeeProgramId"
Write-Output "adjustmentTransactionId=$adjustmentTransactionId reversalTransactionId=$reversalTransactionId"
