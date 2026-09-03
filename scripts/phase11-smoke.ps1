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

function Assert-True([bool]$condition, [string]$message) {
	if (-not $condition) {
		throw $message
	}
}

function Collect-RewardIds($payload) {
	$ids = @()
	foreach ($reward in $payload.availableFreeCoffees) {
		$ids += [string]$reward.id
	}
	foreach ($reward in $payload.availableVouchers) {
		$ids += [string]$reward.id
	}
	return $ids
}

$adminSession = Login-Session "admin@example.test" "CoffeeBeans2026"
$customerSession = Login-Session "thandi@example.test" "CoffeeBeans2026"

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$staffContext = Invoke-Json "Get" "/api/staff/context" $adminSession
Assert-True ($staffContext.data.locations.Count -gt 0) "No active staff locations available"
$locationId = [string]$staffContext.data.locations[0].id

$code = Invoke-Json "Post" "/api/customer/loyalty-code" $customerSession
$otp = [string]$code.data.otp
Assert-True (-not [string]::IsNullOrWhiteSpace($otp)) "Customer OTP generation failed"

$resolved = Invoke-Json "Post" "/api/staff/loyalty-code/resolve" $adminSession @{ otp = $otp }
$customerId = [string]$resolved.data.customerId
Assert-True (-not [string]::IsNullOrWhiteSpace($customerId)) "Resolved customer id missing"
Assert-True ($null -ne $resolved.data.coffee) "Resolved customer has no coffee program"
Assert-True ($null -ne $resolved.data.coffee.threshold) "Coffee threshold is not configured"

$threshold = [int]$resolved.data.coffee.threshold
$current = [int]$resolved.data.coffee.current
Assert-True ($threshold -ge 1) "Invalid coffee threshold"

$existingRewardIds = [System.Collections.Generic.HashSet[string]]::new()
foreach ($id in (Collect-RewardIds $resolved.data)) {
	$null = $existingRewardIds.Add([string]$id)
}

$issuedRewardId = $null
$issuedEarnBillReference = $null
$maxAttempts = 60
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
	$remaining = $threshold - $current
	if ($remaining -le 0) {
		$remaining = $threshold
	}
	$quantity = [Math]::Min([Math]::Max($remaining, 1), 20)
	$issuedEarnBillReference = "PH11-EARN-$stamp-$attempt"
	$idempotencyKey = "phase11-earn-$stamp-$attempt"

	$earn = Invoke-Json "Post" "/api/staff/customers/$customerId/coffee" $adminSession @{
		locationId = $locationId
		quantity = $quantity
		billReference = $issuedEarnBillReference
		idempotencyKey = $idempotencyKey
	}

	if ($null -ne $earn.data.coffee -and $null -ne $earn.data.coffee.threshold) {
		$threshold = [int]$earn.data.coffee.threshold
		$current = [int]$earn.data.coffee.current
	}

	$afterIds = Collect-RewardIds $earn.data
	foreach ($candidate in $afterIds) {
		if (-not $existingRewardIds.Contains([string]$candidate)) {
			$issuedRewardId = [string]$candidate
			break
		}
	}

	if (-not [string]::IsNullOrWhiteSpace($issuedRewardId)) {
		break
	}
}

Assert-True (-not [string]::IsNullOrWhiteSpace($issuedRewardId)) "No new reward was issued after coffee earn attempts"

$detailAfterIssue = Invoke-Json "Get" "/api/admin/customers/$customerId" $adminSession
$issuedReward = $null
foreach ($reward in $detailAfterIssue.data.rewards) {
	if ([string]$reward.id -eq $issuedRewardId) {
		$issuedReward = $reward
		break
	}
}

Assert-True ($null -ne $issuedReward) "Issued reward not visible in admin customer detail"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$issuedReward.issuedAt)) "Issued reward timestamp missing"

$redeemBillReference = "PH11-REDEEM-$stamp"
Invoke-Json "Post" "/api/staff/customers/$customerId/rewards/$issuedRewardId/redeem" $adminSession @{
	locationId = $locationId
	billReference = $redeemBillReference
} | Out-Null

$detailAfterRedeem = Invoke-Json "Get" "/api/admin/customers/$customerId" $adminSession
$redeemedReward = $null
foreach ($reward in $detailAfterRedeem.data.rewards) {
	if ([string]$reward.id -eq $issuedRewardId) {
		$redeemedReward = $reward
		break
	}
}

Assert-True ($null -ne $redeemedReward) "Redeemed reward no longer visible in admin customer detail"
Assert-True (([string]$redeemedReward.status) -eq "redeemed") "Issued reward did not transition to redeemed"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemedReward.redeemedAt)) "Redeemed timestamp missing"

$transactions = Invoke-Json "Get" "/api/admin/transactions?customerId=$customerId&limit=100&offset=0" $adminSession
$earnTx = $null
$redeemTx = $null
foreach ($tx in $transactions.data.transactions) {
	if (($null -eq $earnTx) -and ([string]$tx.billReference -eq $issuedEarnBillReference) -and ([string]$tx.transactionType -eq "earn")) {
		$earnTx = $tx
	}
	if (($null -eq $redeemTx) -and ([string]$tx.billReference -eq $redeemBillReference) -and ([string]$tx.transactionType -eq "redeem")) {
		$redeemTx = $tx
	}
}

Assert-True ($null -ne $earnTx) "Earn transaction not found in admin transactions"
Assert-True ($null -ne $redeemTx) "Redeem transaction not found in admin transactions"

Assert-True (([string]$earnTx.customerId) -eq $customerId) "Earn transaction customer mismatch"
Assert-True (([string]$redeemTx.customerId) -eq $customerId) "Redeem transaction customer mismatch"

Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.staffId)) "Earn transaction staff id missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.staffName)) "Earn transaction staff name missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.staffId)) "Redeem transaction staff id missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.staffName)) "Redeem transaction staff name missing"

Assert-True (([string]$earnTx.locationId) -eq $locationId) "Earn transaction location mismatch"
Assert-True (([string]$redeemTx.locationId) -eq $locationId) "Redeem transaction location mismatch"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.locationName)) "Earn transaction location name missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.locationName)) "Redeem transaction location name missing"

Assert-True (-not [string]::IsNullOrWhiteSpace([string]$earnTx.createdAt)) "Earn transaction timestamp missing"
Assert-True (-not [string]::IsNullOrWhiteSpace([string]$redeemTx.createdAt)) "Redeem transaction timestamp missing"

Write-Output "Phase 11 smoke checks passed"
Write-Output "customerId=$customerId issuedRewardId=$issuedRewardId locationId=$locationId"
Write-Output "earnBillReference=$issuedEarnBillReference redeemBillReference=$redeemBillReference"
