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

## Proje Yapısı

Detaylı mimari, veritabanı şeması ve geliştirme yol haritası için bkz.
[`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Lisans

MIT — bkz. [`LICENSE`](./LICENSE).

## Not

Bu sistem KVKK kapsamında kişisel veri (VKN/TCKN, ad-soyad, adres vb.) işler.
Repoyu **private** tutmanız ve örnek/test belgelerinde gerçek kişisel veri
kullanmamanız (veya maskeleme yapmanız) önerilir.