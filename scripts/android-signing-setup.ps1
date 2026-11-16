# One-time setup of the Android release signing key (docs/android.md, "Signing").
# Run by the repository owner on their own PC, in PowerShell, from the repo root:
#
#   powershell -ExecutionPolicy Bypass -File scripts\android-signing-setup.ps1
#
# It asks for a password (typed, never shown or written anywhere), creates the
# keystore in your user folder, gives it to GitHub Actions as secrets, turns
# Android releases on and writes the public fingerprint to
# android/signing-cert-sha256.txt. Keep the password in your password manager and
# back up the keystore file: losing either means reinstalling the app.

# Native tools write progress to stderr; failures are checked by exit code instead
$ErrorActionPreference = "Continue"
$repo = "Jabberwocky7777/Pokedex-Tracker"
$alias = "pokedextracker"
$keystore = Join-Path $HOME "pokedex-tracker-release.jks"
$fingerprintFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\android")).Path "signing-cert-sha256.txt"

$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool) {
  $keytool = Get-ChildItem "C:\Program Files\Java\*\bin\keytool.exe", "C:\Program Files\Eclipse Adoptium\*\bin\keytool.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $keytool) { throw "keytool not found: install a JDK (17 or later) first." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "The GitHub CLI (gh) isn't installed." }
if (Test-Path $keystore) { throw "$keystore already exists. Not overwriting a signing key." }

Write-Host ""
Write-Host "Choose a password for the signing key (at least 8 characters)."
Write-Host "Save it in your password manager now: it can't be recovered."
$first = Read-Host "Password" -AsSecureString
$second = Read-Host "Same password again" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($first))
$again = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($second))
if ($plain -ne $again) { throw "The two passwords differ. Nothing was created." }
if ($plain.Length -lt 8) { throw "The password is shorter than 8 characters. Nothing was created." }
$env:PDX_KEYSTORE_PASSWORD = $plain

try {
  Write-Host "Creating $keystore ..."
  & $keytool -genkeypair -storetype PKCS12 -keystore $keystore -alias $alias `
    -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Pokedex Tracker, O=Jabberwocky7777" `
    -storepass:env PDX_KEYSTORE_PASSWORD -keypass:env PDX_KEYSTORE_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw "keytool couldn't create the keystore." }

  $listing = & $keytool -list -v -keystore $keystore -alias $alias -storepass:env PDX_KEYSTORE_PASSWORD
  $line = $listing | Select-String "SHA256:" | Select-Object -First 1
  if (-not $line) { throw "Couldn't read the certificate fingerprint." }
  $hex = ($line.ToString() -replace ".*SHA256:\s*", "" -replace "[:\s]", "").ToLower()
  # UTF-8 without a byte-order mark: build-android.yml compares it byte for byte
  [IO.File]::WriteAllText($fingerprintFile, "$hex`n")

  Write-Host "Giving the key to GitHub Actions ..."
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
  gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo --body $b64
  if ($LASTEXITCODE -ne 0) { throw "gh couldn't set the secrets: check 'gh auth status'." }
  gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo --body $plain
  if ($LASTEXITCODE -ne 0) { throw "gh couldn't set the password secret." }
  gh secret set ANDROID_KEY_ALIAS --repo $repo --body $alias
  if ($LASTEXITCODE -ne 0) { throw "gh couldn't set the alias secret." }
  gh variable set ANDROID_RELEASES --repo $repo --body true
  if ($LASTEXITCODE -ne 0) { throw "gh couldn't turn Android releases on." }
} finally {
  Remove-Item Env:PDX_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
  $plain = $null; $again = $null
}

Write-Host ""
Write-Host "Done. Fingerprint (public, now in android/signing-cert-sha256.txt):"
Write-Host "  $hex"
Write-Host ""
Write-Host "Now back up $keystore (a USB stick, or your password manager's file attachment)."
