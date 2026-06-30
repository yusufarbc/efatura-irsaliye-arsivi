# CLAUDE.md

Bu dosya, Claude Code bu repoda çalışırken uyması gereken bağlam ve kurallları içerir.

## Proje Özeti

`efatura-irsaliye-arsivi`: GİB e-Fatura/e-İrsaliye PDF'lerini **OCR kullanmadan**
parse edip SQLite'a kaydeden, web arayüzünden **read-only** sorgulanabilen
muhasebe belge arşivi. Tam teknik spesifikasyon için `PROJECT_SPEC.md` dosyasını
oku — yeni bir özellik veya extractor eklemeden önce mutlaka oraya bak.

## Sabit Kurallar (asla ihlal etme)

1. **OCR kullanma.** PDF'ler metin katmanı gömülü (UBL-TR XML'den render edilmiş).
   `pdftotext -layout` (poppler-utils, child_process ile çağrılır) tek metin
   çıkarma yöntemidir. Tesseract veya başka bir OCR kütüphanesi önerme/ekleme.
2. **Web arayüzü read-only.** `src/server/` altında hiçbir POST/PUT/DELETE/PATCH
   endpoint'i yazma — sadece GET. Veri yazma/güncelleme yalnızca
   `src/ingest/ingestRunner.js` CLI script'i üzerinden yapılır.
3. **Türkçe sayı/tarih formatlarını doğru normalize et.** Kaynak PDF'lerde binlik
   ayraç nokta, ondalık ayraç virgüldür ("15.000,00" = 15000.00). Tarihler
   "GG-AA-YYYY" formatında gelir, DB'ye ISO 8601 ("YYYY-MM-DD") olarak yazılır.
   `src/ingest/normalize.js` içindeki yardımcı fonksiyonları kullan, ham string'i
   asla doğrudan `parseFloat` ile işleme.
4. **Adapter mimarisine sadık kal.** Her entegratör/şablon için
   `src/ingest/extractors/` altında ayrı bir dosya olur. Yeni bir PDF formatı
   tanındığında mevcut extractor'ları değiştirme, yeni dosya ekle ve
   `extractors/index.js` dispatcher'ına kaydet.
5. **Her parse sonucu doğrulanır.** Kalemlerin `mal_hizmet_tutari` toplamı,
   header'daki `mal_hizmet_toplam_tutari` ile ±0.05 TL toleransla eşleşmeli.
   Eşleşmezse `parse_durumu = 'SUPHELI'` ve `parse_notu` alanına sebep yazılır.
   Bu kontrolü atlama veya sessizce yutma.
6. **Kişisel veri içeren örnekleri commit etme.** Test fixture'larında gerçek
   VKN/TCKN, ad-soyad, adres varsa maskele veya sahte veri kullan. Yeni bir örnek
   PDF eklerken bana sor.
7. **DB şemasını değiştirirken migration yaz**, mevcut `schema.sql`'i elle
   bozma — `db/migrations/` altında numaralı yeni dosya ekle.

## Mimari Hatırlatma (detay için PROJECT_SPEC.md)

```
src/
  ingest/
    pdfToText.js        # pdftotext -layout çağrısı
    extractors/          # Her şablon için ayrı dosya + dispatcher (index.js)
    normalize.js         # TR sayı/tarih normalize
    validate.js           # Toplam tutma kontrolü
    ingestRunner.js       # CLI: tek dosya veya klasör tarama
  db/
    schema.sql
    migrations/
    db.js                 # better-sqlite3 bağlantısı
  server/
    app.js                # Express, sadece GET route'lar
    routes/
  web/                     # Frontend (liste, detay, arama, gözden geçirme kuyruğu)
test/
  fixtures/                # Maskelenmiş/sahte örnek PDF'ler + beklenen JSON çıktılar
```

## Komutlar

```bash
npm install
npm test                                          # extractor unit testleri
node src/ingest/ingestRunner.js --dir ./belgeler  # toplu içe aktarma
npm run start                                      # web sunucusu
```

## Yeni Extractor Eklerken İzlenecek Adımlar

1. Örnek PDF'i `pdftotext -layout dosya.pdf -` ile çıktısını al, hangi
   entegratöre ait olduğunu ve mevcut extractor'lardan hangisinin
   tanımadığını doğrula.
2. `test/fixtures/` altına (maskelenmiş) örneği ve beklenen `{header, items}`
   JSON çıktısını ekle.
3. `src/ingest/extractors/<entegrator_adi>.js` dosyasını yaz, ham metni alıp
   ya `{header, items, confidence}` ya da `null` (tanımadıysa) döndürsün.
4. `extractors/index.js` dispatcher'ına ekle.
5. `npm test` ile doğrula, sonra gerçek arşivin bir alt kümesinde
   `ingestRunner.js --dir` çalıştırıp `SUPHELI`/tanınmayan oranını kontrol et.

## Kod Stili

- Türkçe alan adları DB şemasında ve iş mantığında korunur (örn. `mal_hizmet_tutari`,
  `kdv_orani`) — domain'in Türkçe muhasebe terminolojisiyle birebir eşleşmesi
  okunabilirlik için önemli.
- Kod yorumları ve commit mesajları Türkçe veya İngilizce olabilir, tutarlı ol.
- Gereksiz soyutlama yapma; küçük ekip (2-7 kişi) için basit, okunabilir kod tercih
  edilir, aşırı mühendislikten kaçın.

## Yapma

- Bulut/SaaS bir OCR veya PDF-parsing servisine (örn. AWS Textract) bağımlılık
  ekleme — tamamen yerel/offline çalışmalı.
- Web arayüzüne kimlik doğrulama/yetkilendirme sistemi ekleme (şu an kapsam dışı,
  ofis içi küçük ekip kullanımı varsayılıyor) — istenirse ayrıca konuşulur.
- `node_modules`, DB dosyası (`*.sqlite`), veya gerçek PDF arşivini repoya commit
  etme; `.gitignore`'da bunları tut.
