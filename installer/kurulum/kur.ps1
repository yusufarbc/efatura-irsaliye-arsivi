# e-Fatura / e-İrsaliye Arşivi — Windows kurulum sihirbazı
# PowerShell 5.1+ ile çalışır. KUR.bat üzerinden çağrılır.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot   # paket kök klasörü

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  e-Fatura / e-Irsaliye Arsivi - Kurulum"      -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Node.js kontrolü (>= 22.5, node:sqlite için) ---
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[HATA] Node.js bulunamadi." -ForegroundColor Red
    Write-Host "Lutfen once Node.js 22.5 veya ustunu kurun: https://nodejs.org/"
    exit 1
}
$nodeVer = (node --version).TrimStart('v')
$verParts = $nodeVer.Split('.')
$major = [int]$verParts[0]; $minor = [int]$verParts[1]
if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 5)) {
    Write-Host "[HATA] Node.js $nodeVer bulundu; en az 22.5 gerekli (node:sqlite icin)." -ForegroundColor Red
    Write-Host "Guncelleyin: https://nodejs.org/"
    exit 1
}
Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green

# --- 2. pdftotext (poppler) kontrolü ---
$pdftotext = Get-Command pdftotext -ErrorAction SilentlyContinue
if ($pdftotext) {
    Write-Host "[OK] pdftotext bulundu: $($pdftotext.Source)" -ForegroundColor Green
} else {
    Write-Host "[UYARI] pdftotext PATH'te bulunamadi." -ForegroundColor Yellow
    Write-Host "  PDF ice aktarmak icin poppler-windows gereklidir:"
    Write-Host "  https://github.com/oschwartz10612/poppler-windows/releases"
    Write-Host "  -> Zip'i C:\poppler konumuna cikarin ve C:\poppler\Library\bin klasorunu PATH'e ekleyin."
    Write-Host "  (Web arayuzu pdftotext olmadan da calisir; yalnizca PDF isleme icin gerekir.)"
}

# --- 3. Bağımlılıklar (pakette hazır gelir; eksikse npm install) ---
if (Test-Path (Join-Path $root 'node_modules\express')) {
    Write-Host "[OK] Bagimliliklar pakete dahil (cevrimdisi kurulum)." -ForegroundColor Green
} else {
    Write-Host "Bagimliliklar yukleniyor (npm install)..."
    Push-Location $root
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[HATA] npm install basarisiz oldu." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Bagimliliklar yuklendi." -ForegroundColor Green
}

# --- 4. Kurulum tipi seçimi ---
Write-Host ""
Write-Host "Kurulum tipi secin:"
Write-Host "  [1] Deneme / gelistirme: sunucuyu simdi baslat (http://localhost:8888)"
Write-Host "  [2] Windows servisi olarak kur (onerilen - bilgisayar acilinca otomatik baslar)"
Write-Host "  [3] Cikis (yalnizca dosyalari birak)"
$secim = Read-Host "Seciminiz (1/2/3)"

switch ($secim) {
    '1' {
        Write-Host ""
        Write-Host "Sunucu baslatiliyor... Durdurmak icin Ctrl+C." -ForegroundColor Cyan
        Write-Host "Tarayicida acin: http://localhost:8888"
        Push-Location $root
        npm start
        Pop-Location
    }
    '2' {
        Write-Host ""
        Write-Host "Servis kurum agina acik kurulur (HOST=0.0.0.0)." -ForegroundColor Yellow
        Write-Host "Agdaki diger bilgisayarlar erisebilecegi icin panel parolasi onerilir."
        $parolaIste = Read-Host "Panel parolasi belirlensin mi? (E/h)"
        if ($parolaIste -ne 'h' -and $parolaIste -ne 'H') {
            $env:PANEL_USER = Read-Host "Kullanici adi"
            $env:PANEL_PASS = Read-Host "Parola"
        }
        Write-Host ""
        Write-Host "Gizli yol: belirlenirse panel adresi gizlenir; paneli yalnizca"
        Write-Host "http://<adres>/<gizli-yol> adresini bir kez ziyaret edenler gorebilir."
        $gizliYol = Read-Host "Gizli yol belirleyin (bos birakirsaniz ozellik kapali kalir)"
        if ($gizliYol) { $env:SECRET_PATH = $gizliYol }
        $sadeceYerel = Read-Host "Yalnizca bu bilgisayardan erisim olsun mu? (e/H)"
        if ($sadeceYerel -eq 'e' -or $sadeceYerel -eq 'E') { $env:HOST = '127.0.0.1' }
        Push-Location $root
        npm run service:install
        Pop-Location
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[OK] Servis kuruldu. Panel: http://localhost:8888" -ForegroundColor Green
            if ($env:SECRET_PATH) {
                Write-Host "Gizli yol aktif - panele ilk erisim: http://localhost:8888/$($env:SECRET_PATH)" -ForegroundColor Yellow
                Write-Host "Bu adresi not edin; ziyaret etmeyen tarayicilar 404 gorur."
            }
            Write-Host "Kaldirmak icin bu klasorde: npm run service:uninstall"
        } else {
            Write-Host "[HATA] Servis kurulumu basarisiz. Ayrintilar yukarida." -ForegroundColor Red
            exit 1
        }
    }
    default {
        Write-Host ""
        Write-Host "Kurulum tamamlandi (servis kurulmadi)." -ForegroundColor Green
        Write-Host "Baslatmak icin bu klasorde: npm start"
    }
}

Write-Host ""
Write-Host "Sonraki adimlar KURULUM.md dosyasinda: PDF ice aktarma, otomatik yedek, otomatik ingest."
