# Publishes the Windows installer to GitHub Releases.
# Requires a stored GitHub credential for github.com (git credential fill) and
# a built dist/DroidCrate-<version>-Setup.exe. Never prints the token.
param(
  [string]$Version = '0.1.0',
  [string]$Tag = 'v0.1.0'
)

$ErrorActionPreference = 'Stop'
$repo = 'bouadjadjatamer2-hub/DroidCrate'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$credInput = "protocol=https`nhost=github.com`n`n"
$cred = $credInput | git credential fill
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
if (-not $token) { throw 'No GitHub token was found in git credentials.' }
$headers = @{
  Authorization          = "token $token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'DroidCrate-release'
}

$notesPath = Join-Path $root "docs/releases/$Tag.md"
if (-not (Test-Path $notesPath)) { throw "Release notes not found: $notesPath" }
$installer = Join-Path $root "dist/DroidCrate-$Version-Setup.exe"
if (-not (Test-Path $installer)) { throw "Installer not found: $installer" }

function Get-Release {
  try {
    return Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$Tag" -Headers $headers
  } catch {
    return $null
  }
}

$release = Get-Release
if (-not $release) {
  $payload = @{
    tag_name   = $Tag
    name       = "DroidCrate $Version"
    body       = [System.IO.File]::ReadAllText($notesPath, [System.Text.Encoding]::UTF8)
    draft      = $false
    prerelease = $false
  } | ConvertTo-Json -Depth 4
  $payloadPath = Join-Path $env:TEMP "droidcrate-release-$Tag.json"
  [System.IO.File]::WriteAllText($payloadPath, $payload, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Creating release $Tag..."
  $response = & curl.exe --silent --show-error --fail --retry 4 --retry-delay 5 --max-time 120 `
    -X POST `
    -H "Authorization: token $token" `
    -H 'Accept: application/vnd.github+json' `
    -H 'Content-Type: application/json; charset=utf-8' `
    -H 'User-Agent: DroidCrate-release' `
    --data-binary "@$payloadPath" `
    "https://api.github.com/repos/$repo/releases"
  if ($LASTEXITCODE -ne 0) { throw "Release creation failed (curl exit $LASTEXITCODE)." }
  $release = $response | ConvertFrom-Json
  Remove-Item $payloadPath -Force
} else {
  Write-Host "Release $Tag already exists; reusing it."
}

$existing = @()
if ($release.assets) { $existing = $release.assets | ForEach-Object { $_.name } }

$assets = @($installer)
$latest = Join-Path $root 'dist/latest.yml'
if (Test-Path $latest) { $assets += $latest }

foreach ($asset in $assets) {
  $name = Split-Path $asset -Leaf
  if ($existing -contains $name) {
    Write-Host "Asset already uploaded: $name"
    continue
  }
  Write-Host "Uploading $name..."
  $encoded = [uri]::EscapeDataString($name)
  & curl.exe --silent --show-error --fail --retry 4 --retry-delay 5 --max-time 900 `
    -X POST `
    -H "Authorization: token $token" `
    -H 'Accept: application/vnd.github+json' `
    -H 'Content-Type: application/octet-stream' `
    -H 'User-Agent: DroidCrate-release' `
    --data-binary "@$asset" `
    "https://uploads.github.com/repos/$repo/releases/$($release.id)/assets?name=$encoded"
  if ($LASTEXITCODE -ne 0) { throw "Upload failed for $name (curl exit $LASTEXITCODE)." }
  Write-Host "Uploaded $name."
}

$final = Get-Release
Write-Host "Release: $($final.html_url)"
$final.assets | ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.name, ($_.size / 1MB)) }
