# Muhasebe Belge Arşivi & Sorgulama Sistemi - Proje Spesifikasyonu

## Amaç

Yüzlerce e-Fatura ve e-İrsaliye PDF'ini (GİB resmi "yazdırılabilir görünüm" formatı,
farklı entegratörlerden gelebilir) **OCR kullanmadan**, PDF'in gömülü metin
katmanından (text layer) okuyup yapısal veriye dönüştürmek, SQLite veritabanına
kaydetmek ve bir web arayüzünden **read-only** sorgulatmak.

## Kritik prensip: OCR YOK

Bu PDF'ler taranmış görüntü değil — UBL-TR XML'den render edilmiş, metin katmanı
gömülü PDF'lerdir. `pdftotext -layout` (poppler-utils) ile karakterler doğrudan ve
güvenilir şekilde çıkarılabilir. OCR'a (Tesseract vb.) kesinlikle gerek yoktur ve
kullanılmamalıdır — hem gereksiz hem de daha hataya açıktır.

## Doğrulanmış örnek çıktı

Gerçek bir GİB e-Fatura PDF'i üzerinde `pdftotext -layout dosya.pdf -` çalıştırıldığında
alınan çıktı (referans için aşağıda), parser'ın bu formatı işlemesi gerekiyor:

```
                                                               E-Fatura


*****
*****
*****
*****
Tel: +90**********
Vergi Dairesi: ***** Vergi Dairesi
TCKN: ***********


SAYIN
*****
*****                                                                                        Özelleştirme No:      TR1.2.1
*****                                            Senaryo:              TICARIFATURA
 *****                                                                                       Fatura Tipi:          SATIS
*****                                                                                        Fatura No:            RF02026000000007
                                                                                            Düzenleme Tarihi: 30-06-2026
E-Posta: *****
                                                                                            Düzenleme
Vergi Dairesi: ***** Vergi Dairesi                                                                                  10:09:13
                                                                                            Zamanı:
VKN: **********

ETTN: ********-****-****-****-************
Sıra
           Malzeme/Hizmet Açıklaması               Miktar      Birim Fiyat     KDV Oranı        KDV Tutarı        Mal Hizmet Tutarı
No
       Siber Güvenlik Danışmanlığı Hizmet
1                                                     1 Adet       15.000 TL         %20,00         3.000,00 TL             15.000,00 TL
       Bedeli




                                                                                           Mal Hizmet Toplam Tutarı         15.000,00 TL
                                                                                              Hesaplanan KDV(%20)            3.000,00 TL
                                                                                       Vergiler Dahil Toplam Tutar          18.000,00 TL
                                                                                                    Ödenecek Tutar          18.000,00 TL




Yalnız: On Sekiz Bin Türk Lirası

İrsaliye yerine geçer.
```

### Gözlemler (parser tasarımı için önemli)

1. **İki blok karşılıklı/iç içe basılıyor**: Üstte alıcı (*****) bilgisi
   sol tarafta, "SAYIN" (satıcı) bilgisi de ayrı bir blokta ama `-layout` çıktısında
   satır satır karışık görünebiliyor çünkü PDF'te bunlar yan yana kutular. Parser,
   anchor kelimelerle (VKN:, TCKN:, SAYIN, Fatura No:, vb.) alanları ayıklamalı,
   satır pozisyonuna güvenmemeli.
2. **Başlık/değer aynı satırda olmayabilir** ("Düzenleme / Zamanı:" iki satıra
   bölünmüş, değer ayrı sütunda). Regex'ler çok satırlı label'lara tolerant olmalı.
3. **Kalem tablosu**: "Sıra No" başlığı ile gerçek "1" değeri arasına açıklama metni
   girebiliyor (çok satırlı ürün açıklaması: "Siber Güvenlik Danışmanlığı Hizmet
   Bedeli" iki satıra bölünmüş, "1" rakamı ortada bir yerde duruyor). Kalem satırı
   tespiti şu pattern'e göre yapılmalı: bir satırda **miktar + birim + birim fiyat +
   KDV% + KDV tutarı + toplam tutar** kalıbının hepsi bulunan satır = gerçek veri
   satırı; önceki satır(lar) o kalemin açıklaması (sıra no ile bu veri satırı
   arasındaki tüm metin birleştirilerek açıklama oluşturulur).
4. **Sayı formatı**: Türkçe format — binlik ayraç nokta (.), ondalık ayraç virgül (,).
   "15.000,00 TL" = 15000.00. "%20,00" = %20. Parse ederken bu format'a göre
   normalize edilmeli (örn. `parseTrNumber("15.000,00")` → `15000.00`).
5. **Boş satırlar**: PDF şablonunda kalem tablosunda kullanılmayan boş satırlar da
   var (form alanı gibi) — bunlar pdftotext çıktısında boş satır veya hiç görünmeyebilir,
   parser kalem regex'ine uymayan satırları yok saymalı.
6. **Footer metni**: "Yalnız: <yazıyla tutar>" ve "İrsaliye yerine geçer." gibi
   serbest metin notları da yakalanmalı (opsiyonel alan, DB'de notes sütunu).
7. **Farklı entegratörler farklı şablon kullanabilir** (Logo, Mikro, Foriba, Nilvera,
   QNB eFinans, Uyumsoft vb.) — bu yüzden parser tek monolitik regex değil,
   adapter/strateji yapısında olmalı (bkz. "Parser Mimarisi" altında).

## Çıkarılacak Alanlar

### Belge başlığı (header)
- belge_tipi: FATURA | IRSALIYE (irsaliye PDF'leri ayrıca incelenip benzer spec çıkarılacak — şimdilik fatura örneği var)
- fatura_no / belge_no
- ettn (UUID, GİB belge kimliği — varsa benzersiz anahtar olarak kullanılmalı)
- duzenleme_tarihi, duzenleme_zamani
- senaryo (TICARIFATURA, vb.), fatura_tipi (SATIS, IADE vb.)
- satici: unvan/ad-soyad, adres, vkn/tckn, vergi_dairesi, e-posta, telefon
- alici: unvan/ad-soyad, adres, vkn/tckn, vergi_dairesi, e-posta, telefon
- mal_hizmet_toplam_tutari
- hesaplanan_kdv_toplam (ve KDV oranı varsa)
- vergiler_dahil_toplam_tutar
- odenecek_tutar
- notlar (serbest metin: "Yalnız: ...", "İrsaliye yerine geçer." vb.)
- kaynak_dosya (orijinal PDF dosya adı/yolu)
- parse_durumu: BASARILI | SUPHELI | HATALI
- parse_notu (doğrulama başarısızsa neden)

### Kalemler (items, 1-N per belge)
- sira_no
- aciklama (çok satırlı olabilir, birleştirilmiş)
- miktar, birim (Adet, Kg, vb.)
- birim_fiyat
- kdv_orani (%)
- kdv_tutari
- mal_hizmet_tutari (satır toplamı)

## Doğrulama Kuralı (Validation)

Parse edilen kalemlerin `mal_hizmet_tutari` toplamı, header'daki
`mal_hizmet_toplam_tutari` ile (küçük yuvarlama farkı toleransıyla, örn. ±0.05 TL)
eşleşmeli. Eşleşmezse belge `SUPHELI` olarak işaretlenip web arayüzünde ayrı bir
"gözden geçirilmesi gerekenler" filtresinde gösterilmeli. Aynı şekilde
`hesaplanan_kdv_toplam` = kalemlerin KDV tutarları toplamı kontrolü de yapılmalı.

## Parser Mimarisi (Node.js)

```
src/
  ingest/
    pdfToText.js        # pdftotext -layout çağrısı (child_process), encoding kontrolü
    extractors/
      index.js           # Hangi extractor kullanılacağına karar veren dispatcher
      gibStandardInvoice.js   # Yukarıdaki örnek formata göre yazılan ilk extractor
      gibStandardWaybill.js   # İrsaliye varyantı (örnek geldiğinde eklenecek)
      // İleride yeni entegratör formatları için yeni dosyalar eklenir
    normalize.js         # Türkçe sayı/tarih normalize fonksiyonları
    validate.js           # Toplam tutma kontrolü, SUPHELI/BASARILI kararı
    ingestRunner.js       # Klasördeki tüm PDF'leri tarar, parse eder, DB'ye yazar
  db/
    schema.sql
    db.js                 # better-sqlite3 bağlantısı
  server/
    app.js                # Express, read-only API endpoint'leri
    routes/
      documents.js         # GET /api/documents (filtreli liste)
      documents_detail.js  # GET /api/documents/:id (kalemler dahil detay)
      items_search.js      # GET /api/items?q=... (kalem bazlı arama, örn. ürün adına göre)
  web/                     # Basit frontend (React veya vanilla — tercihe göre)
```

Her extractor, gelen ham metni alıp ya `{ header, items, confidence }` döndürür ya
da `null` döndürüp "bu formatı tanımadım" der; dispatcher sırayla dener, ilk eşleşeni
kullanır. Yeni bir entegratör formatı geldiğinde mevcut extractor'lara dokunmadan
yeni bir dosya eklenir — bu da "yüzlerce belge, karışık şablon" senaryosuna
ölçeklenebilir bir çözüm sağlar.

## Veritabanı Şeması

`schema.sql` başlangıç (ilk kurulum) şemasını tanımlar; sonraki tüm yapısal
değişiklikler `db/migrations/` altına numaralı `.sql` dosyaları olarak eklenir
ve `src/db/db.js` içindeki basit migration runner tarafından (henüz
uygulanmamışsa) otomatik çalıştırılır — `schema.sql` asla elle bozulmaz.

`0001_taraflar.sql` migration'ı ile satıcı/alıcı bilgisi (VKN/TCKN ile) ayrı
bir `taraflar` tablosuna taşındı: aynı taraf (aynı VKN/TCKN) birden çok
faturada geçtiğinde unvan/adres/vergi dairesi her belgede tekrar yazılmaz,
`documents.satici_id` / `documents.alici_id` o tek satırı referans eder
(bire-çok ilişki: bir taraf → birçok fatura).

```sql
-- schema.sql (ilk kurulum)
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  belge_tipi TEXT NOT NULL CHECK(belge_tipi IN ('FATURA','IRSALIYE')),
  belge_no TEXT,
  ettn TEXT UNIQUE,
  duzenleme_tarihi TEXT,        -- ISO 8601 (YYYY-MM-DD)
  duzenleme_zamani TEXT,
  senaryo TEXT,
  fatura_tipi TEXT,
  mal_hizmet_toplam_tutari REAL,
  hesaplanan_kdv_toplam REAL,
  vergiler_dahil_toplam_tutar REAL,
  odenecek_tutar REAL,
  notlar TEXT,
  kaynak_dosya TEXT NOT NULL,
  parse_durumu TEXT NOT NULL CHECK(parse_durumu IN ('BASARILI','SUPHELI','HATALI')),
  parse_notu TEXT,
  olusturma_tarihi TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sira_no INTEGER,
  aciklama TEXT,
  miktar REAL,
  birim TEXT,
  birim_fiyat REAL,
  kdv_orani REAL,
  kdv_tutari REAL,
  mal_hizmet_tutari REAL
);

CREATE INDEX idx_documents_ettn ON documents(ettn);
CREATE INDEX idx_documents_tarih ON documents(duzenleme_tarihi);
CREATE INDEX idx_items_aciklama ON items(aciklama);
CREATE INDEX idx_items_document ON items(document_id);
```

```sql
-- db/migrations/0001_taraflar.sql (satıcı/alıcı normalize edilmesi)
CREATE TABLE taraflar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unvan TEXT NOT NULL,
  vkn_tckn TEXT UNIQUE,
  vergi_dairesi TEXT,
  adres TEXT,
  eposta TEXT,
  telefon TEXT,
  olusturma_tarihi TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE documents ADD COLUMN satici_id INTEGER REFERENCES taraflar(id);
ALTER TABLE documents ADD COLUMN alici_id INTEGER REFERENCES taraflar(id);
-- satici_unvan, satici_vkn_tckn, ... alici_telefon sütunları documents'tan
-- kaldırıldı (bkz. migration dosyasının tamamı)
```

`ettn` UNIQUE olduğu için aynı belgenin tekrar yüklenmesi (re-ingest) durumunda
upsert mantığı kurulmalı (var olan kaydı silip yeniden yazma veya güncelleme).

## Web Arayüzü (read-only)

- **Belge listesi**: tarih aralığı, belge tipi (fatura/irsaliye), satıcı/alıcı
  unvanı, belge no, parse_durumu filtreleri ile tablo görünümü.
- **Belge detayı**: header bilgileri + kalemler tablosu, orijinal PDF'e link
  (varsa dosya sunucudan serve edilir, salt okunur).
- **Kalem arama**: ürün/hizmet açıklamasına göre serbest metin arama (örn. "Siber
  Güvenlik" yazınca o açıklamayı içeren tüm kalemler, hangi faturada, hangi
  tarihte, ne tutarda olduğu listelenir) — muhasebe tarafının en çok ihtiyaç
  duyacağı özelliklerden biri muhtemelen budur.
- **Gözden geçirme kuyruğu**: parse_durumu = SUPHELI veya HATALI olan belgeler ayrı
  sekmede, sebebiyle (parse_notu) birlikte.
- Tüm API read-only: GET endpoint'leri dışında hiçbir yazma/silme endpoint'i web
  arayüzünden açılmamalı (veri girişi sadece ingest script/CLI üzerinden, terminalden
  çalıştırılır — küçük ekip senaryosunda bu basit ve güvenli bir ayrım).

## Toplu İşleme (Ingest) Akışı

CLI script: `node src/ingest/ingestRunner.js --dir ./belgeler`
- Klasördeki tüm `.pdf` dosyalarını bulur
- Her biri için: `pdftotext -layout` çalıştırır → ham metni extractor dispatcher'a
  verir → header+items çıkarır → validate eder → DB'ye yazar (ETTN varsa upsert)
- Sonunda özet rapor basar: kaç belge BASARILI, kaç SUPHELI, kaç HATALI, hangi
  dosyalar hiç tanınmadı (extractor bulunamadı) — bu sonuncular yeni şablon
  ihtiyacını gösterir, manuel inceleme + yeni extractor yazımı gerekir.

## Teknoloji Yığını

- **Runtime**: Node.js (LTS)
- **PDF text extraction**: poppler-utils (`pdftotext` CLI, child_process ile çağrılır)
  — sistemde kurulu olmalı (`apt install poppler-utils` / Docker image'a eklenir)
- **DB**: better-sqlite3 (senkron API, ingest script'i için pratik)
- **Backend**: Express (basit, read-only REST API)
- **Frontend**: Basit React (Vite) veya hatta vanilla HTML+JS — küçük ekip, basit
  filtre/tablo ihtiyacı için aşırı mühendislik gerekmiyor; React tercih edilirse
  tek sayfa, birkaç bileşen yeterli.
- **Test**: Örnek PDF'ler `test/fixtures/` altında saklanır (hassas veri varsa
  maskelenmiş örnekler), her extractor için snapshot/unit test yazılır.

## Yol Haritası (Claude Code için adım adım)

1. Proje iskeleti (package.json, klasör yapısı, SQLite şema migration)
2. `pdfToText.js` + ilk extractor (`gibStandardInvoice.js`) — yukarıdaki örnek
   PDF ile birebir test edilip header+1 kalem doğru çıkana kadar iterasyon
3. `normalize.js` (TR sayı/tarih formatları) + `validate.js` (toplam tutma kontrolü)
4. `ingestRunner.js` CLI — tek dosya ve klasör modunda çalışsın
5. Birkaç farklı gerçek örnek (irsaliye + farklı entegratör faturası) eklenince
   extractor'lar genişletilir
6. Express API + basit frontend (liste, detay, arama, gözden geçirme kuyruğu)
7. Tüm mevcut PDF arşivi üzerinde ingest çalıştırılıp sonuç raporu incelenir,
   SUPHELI/tanınmayan belgeler için extractor iyileştirmesi yapılır

## Önemli Notlar / Riskler

- **VKN/TCKN gibi kişisel veriler içeriyor** — repo private olmalı, örnek
  fixture'larda gerçek kişisel veri varsa maskelenmesi düşünülmeli.
- **İrsaliye örneği henüz yok** — irsaliye PDF formatı muhtemelen faturaya çok
  benzer ama farklı alanlar (taşıyıcı bilgisi, sevk tarihi vb.) içerebilir; ilk
  irsaliye örneği geldiğinde extractor ayrıca yazılmalı.
- **Çok satırlı açıklama tespiti** parser'ın en kırılgan noktası; gerçek
  veri setiyle test edilirken bu kısma özel dikkat gerekir.
