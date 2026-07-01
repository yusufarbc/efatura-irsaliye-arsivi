# efatura-irsaliye-arsivi

OCR kullanmadan e-Fatura ve e-İrsaliye PDF'lerini (GİB resmi "yazdırılabilir
görünüm" formatı) parse edip SQLite veritabanına kaydeden, web arayüzünden
**read-only** sorgulanabilen muhasebe belge arşivi sistemi.

## Neden OCR yok?

GİB'in e-Fatura/e-İrsaliye PDF'leri taranmış görüntü değildir — UBL-TR XML'den
render edilmiş, metin katmanı (text layer) gömülü PDF'lerdir. Bu yüzden karakterler
`pdftotext -layout` (poppler-utils) ile doğrudan ve güvenilir şekilde çıkarılabilir.
OCR (Tesseract vb.) hem gereksizdir hem de daha hataya açık bir yaklaşım olurdu.

## Özellikler

- PDF metin katmanından (OCR'sız) başlık ve kalem (satır) bilgisi çıkarma
- Farklı e-fatura entegratörlerinin (Logo, Mikro, Foriba, Nilvera, QNB eFinans vb.)
  şablon farklılıklarına uyum sağlayan adapter tabanlı parser mimarisi
- Kalem toplamlarının fatura geneliyle tutarlılık kontrolü (otomatik doğrulama)
- Toplu (batch) PDF işleme — bir klasördeki yüzlerce belgeyi tek seferde içe aktarma
- SQLite veritabanı, sorgulanabilir yapı (belge no, tarih, satıcı/alıcı, ürün/hizmet
  açıklaması bazlı arama)
- Web arayüzünden **sadece okuma** (read-only) erişim — veri girişi yalnızca CLI
  üzerinden yapılır, arayüzden hiçbir yazma/silme işlemi yapılamaz

## Teknoloji

- **Node.js 22.5+** + **Express** (backend API)
- **node:sqlite** — Node.js built-in SQLite (sıfır native bağımlılık, C++ build gerekmez)
- **poppler-utils** / `pdftotext -layout` (PDF metin çıkarma, OCR yok)
- Vanilla HTML + CSS + JS (framework'süz frontend)

## Kurulum

```bash
# 1. Node.js 22.5+ gereklidir (node:sqlite için)
node --version

# 2. poppler-utils (pdftotext için)
#    Ubuntu/Debian:
sudo apt install poppler-utils
#    Windows: https://github.com/oschwartz10612/poppler-windows/releases
#    → C:\poppler\ konumuna çıkart, PATH'e ekle

# 3. Bağımlılıkları yükle (sadece express)
npm install
```

## Kullanım

```bash
# Tek PDF içe aktar
npm run ingest -- --file fatura.pdf

# Klasördeki tüm PDF'leri içe aktar
npm run ingest -- --dir ./belgeler

# Önce denemek istersen (DB'ye yazmadan)
npm run ingest -- --dir ./belgeler --dry-run

# Web arayüzünü başlat → http://localhost:3000
npm start
```

## Windows'ta Servis Olarak Çalıştırma

Web sunucusunun bilgisayar her açıldığında otomatik başlaması için
`node-windows` ile Windows Service olarak kaydedilebilir. Aşağıdaki komutlar
**Yönetici (Administrator)** PowerShell'den çalıştırılmalıdır:

```powershell
# Servisi kur ve başlat (EFaturaArsivServisi)
npm run service:install

# Servisi kaldır
npm run service:uninstall
```

Kurulum farklı bir port istiyorsa: `$env:PORT=3001; npm run service:install`

İsteğe bağlı olarak, `ingestRunner.js`'i her gün belirli bir saatte otomatik
çalıştırmak için Windows Görev Zamanlayıcı'ya (Task Scheduler) bir görev
eklenebilir — bu sürekli çalışan bir servis değil, periyodik bir toplu iştir:

```powershell
# Varsayılan: her gün 07:00, ./belgeler klasörü
npm run task:install-ingest

# Farklı klasör/saat ile
$env:INGEST_DIR="D:\belgeler"; $env:INGEST_TIME="23:00"; npm run task:install-ingest

# Kaldırmak için
npm run task:uninstall-ingest
```

## Proje Yapısı

Detaylı mimari, veritabanı şeması ve geliştirme yol haritası için bkz.
[`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Lisans

MIT — bkz. [`LICENSE`](./LICENSE).

## Not

Bu sistem KVKK kapsamında kişisel veri (VKN/TCKN, ad-soyad, adres vb.) işler.
Repoyu **private** tutmanız ve örnek/test belgelerinde gerçek kişisel veri
kullanmamanız (veya maskeleme yapmanız) önerilir.
