$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-True([bool]$condition, [string]$message) {
	if (-not $condition) {
		throw $message
	}
}

function Require-Pattern([string]$path, [string]$pattern, [string]$message) {
	$match = Select-String -Path $path -Pattern $pattern -SimpleMatch
	Assert-True ($null -ne $match) $message
}

Assert-True (Test-Path "dist/client/manifest.webmanifest") "Build manifest not found. Run npm run build first."
Assert-True (Test-Path "dist/client/sw.js") "Build service worker not found. Run npm run build first."

$manifestResponse = Get-Content "dist/client/manifest.webmanifest" -Raw | ConvertFrom-Json
Assert-True ($manifestResponse.name -eq "Fives Rewards") "Manifest name mismatch"
Assert-True ($manifestResponse.short_name -eq "Fives") "Manifest short name mismatch"
Assert-True ($manifestResponse.display -eq "standalone") "Manifest display must be standalone"
Assert-True ($manifestResponse.start_url -eq "/") "Manifest start_url must be /"
Assert-True ($manifestResponse.scope -eq "/") "Manifest scope must be /"
Assert-True ($manifestResponse.icons.Count -ge 3) "Manifest should include at least three icons"

$hasMaskable = $false
foreach ($icon in $manifestResponse.icons) {
	$purpose = ""
	if ($icon.PSObject.Properties.Name -contains "purpose") {
		$purpose = [string]$icon.purpose
	}
	if ($purpose -and $purpose -like "*maskable*") {
		$hasMaskable = $true
		break
	}
}
Assert-True $hasMaskable "Manifest maskable icon missing"

Assert-True (Test-Path "public/icons/icon-192.png") "Missing icon-192.png"
Assert-True (Test-Path "public/icons/icon-512.png") "Missing icon-512.png"
Assert-True (Test-Path "public/icons/icon-512-maskable.png") "Missing icon-512-maskable.png"
Assert-True (Test-Path "public/icons/apple-touch-icon.png") "Missing apple-touch-icon.png"

Require-Pattern "src/lib/api.ts" "navigator.onLine === false" "Offline mutation connectivity guard missing"
Require-Pattern "src/features/customer/api.ts" "fetchCustomerMenuWithCache" "Menu read cache fallback missing"
Require-Pattern "src/features/staff/scanner.ts" "export interface ScannerService" "Scanner abstraction missing"
Require-Pattern "src/features/system/notifications.tsx" "export interface NotificationProviderService" "Notification abstraction missing"
Require-Pattern "src/lib/storage.ts" "export interface KeyValueStore" "Storage abstraction missing"
Require-Pattern "src/providers/AppProviders.tsx" "PwaInstallPrompt" "PWA install prompt not mounted"
Require-Pattern "src/providers/AppProviders.tsx" "ConnectivityBanner" "Offline banner not mounted"

Write-Output "Phase 12 smoke checks passed"
