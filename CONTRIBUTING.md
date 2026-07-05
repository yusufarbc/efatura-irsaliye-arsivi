# Katkı Rehberi

Katkılarınızı memnuniyetle karşılıyoruz — hata bildirimi, yeni entegratör
şablonu (extractor), belge iyileştirmesi… hepsi değerlidir.

## Geliştirme ortamı

- **Node.js 22.5+** (`node:sqlite` için gerekli)
- **poppler-utils** (`pdftotext` PATH'te olmalı) — yalnızca gerçek PDF
  işlemek için; testler fixture'larla çalıştığından zorunlu değildir

```bash
git clone https://github.com/yusufarbc/efatura-irsaliye-arsivi.git
cd efatura-irsaliye-arsivi
npm install
npm test        # 52 test, tamamı fixture tabanlı (PDF/pdftotext gerekmez)
npm start       # http://localhost:8888
```

## Yeni entegratör şablonu (extractor) ekleme

En değerli katkı türü budur. Farklı bir e-fatura entegratörünün PDF şablonu
doğru parse edilmiyorsa:

1. `pdftotext -layout belge.pdf çıktı.txt` ile metni çıkarın.
2. Çıktıdaki **tüm kişisel verileri maskeleyin** (VKN/TCKN, ad-soyad, adres,
   telefon, e-posta, ETTN). `test/fixtures/gib_standard_invoice_sample.txt`
   dosyasındaki örnek biçimi izleyin.
3. `src/ingest/extractors/` altına yeni adapter ekleyin ve
   `extractors/index.js` içinde kaydedin.
4. Maskelenmiş fixture + beklenen JSON ile test yazın
   (`test/extractor.test.js` örnek alınabilir).

> **Önemli:** Gerçek kişisel veri içeren PDF veya metin dosyalarını asla
> commit etmeyin. Bkz. [SECURITY.md](SECURITY.md).

## Pull request süreci

1. Fork'layıp konu dalı açın (`feat/...`, `fix/...`).
2. `npm test` yeşil olmalı; yeni davranışa test ekleyin.
3. Commit mesajlarında [Conventional Commits](https://www.conventionalcommits.org/tr/)
   biçimi tercih edilir (`feat:`, `fix:`, `docs:`…).
4. PR açıklamasında *neyi neden* değiştirdiğinizi yazın.

## Hata bildirimi

Issue açarken şunları ekleyin: Node.js sürümü, işletim sistemi, hatanın tam
çıktısı ve (mümkünse) **maskelenmiş** `pdftotext -layout` çıktısı.
