# Windows kurulum paketini (zip) derler.
# Kullanım: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-win.ps1
# Çıktı:   dist/efatura-irsaliye-arsivi-<surum>-windows.zip
#
# Paket, node_modules dahil kendi kendine yeten bir kurulumdur; hedef
# makinede yalnızca Node.js 22.5+ ve (PDF işleme için) poppler gerekir.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$name = "efatura-irsaliye-arsivi-$version-windows"

$dist = Join-Path $root 'dist'
$stage = Join-Path $dist $name
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null

Write-Host "Paketleniyor: $name"

# --- Uygulama dosyaları ---
Copy-Item (Join-Path $root 'src')     (Join-Path $stage 'src')     -Recurse
Copy-Item (Join-Path $root 'scripts') (Join-Path $stage 'scripts') -Recurse
Copy-Item (Join-Path $root 'db')      (Join-Path $stage 'db')      -Recurse
foreach ($f in 'package.json', 'package-lock.json', 'README.md', 'LICENSE', 'CHANGELOG.md') {
    Copy-Item (Join-Path $root $f) $stage
}

# Servis çalışma artıkları pakete girmesin
$daemon = Join-Path $stage 'src\server\daemon'
if (Test-Path $daemon) { Remove-Item -Recurse -Force $daemon }
# Paketleme scriptinin kendisi son kullanıcı paketine gerekli değil
Remove-Item (Join-Path $stage 'scripts\package-win.ps1') -ErrorAction SilentlyContinue

# --- Kurulum sihirbazı ve kaldırma aracı ---
Copy-Item (Join-Path $root 'installer\KUR.bat')    $stage
Copy-Item (Join-Path $root 'installer\KALDIR.bat') $stage
Copy-Item (Join-Path $root 'installer\KURULUM.md') $stage
Copy-Item (Join-Path $root 'installer\kurulum')    (Join-Path $stage 'kurulum') -Recurse

# --- Bağımlılıklar (çevrimdışı kurulum için pakete gömülür) ---
Write-Host "Bagimliliklar yukleniyor (npm ci)..."
Push-Location $stage
npm ci --no-audit --no-fund --loglevel=error
$ciExit = $LASTEXITCODE
Pop-Location
if ($ciExit -ne 0) { throw "npm ci basarisiz (cikis kodu $ciExit)" }

# --- Zip (tar.exe: standart '/' ayraçlı, her platformda açılabilen zip üretir) ---
$zip = Join-Path $dist "$name.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }
tar -a -c -f $zip -C $dist $name
if ($LASTEXITCODE -ne 0) { throw "zip olusturulamadi (tar cikis kodu $LASTEXITCODE)" }
Remove-Item -Recurse -Force $stage

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "[OK] $zip ($sizeMb MB)" -ForegroundColor Green
