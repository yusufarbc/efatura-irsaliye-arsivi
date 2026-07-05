# Changelog

Bu projedeki dikkate değer değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) standardına,
sürümleme [Semantic Versioning](https://semver.org/lang/tr/) kurallarına uyar.

## [1.0.0] - 2026-07-05

İlk kararlı sürüm. 🎉

### Eklendi

- **Ingest hattı**: GİB e-Fatura/e-İrsaliye PDF'lerini (resmi "yazdırılabilir
  görünüm") `pdftotext -layout` ile OCR'sız parse etme; tek dosya, klasör
  (batch) ve `--dry-run` modları
- **Adapter tabanlı parser mimarisi**: farklı e-fatura entegratörlerinin
  (Logo, Mikro, Foriba, Nilvera, QNB eFinans vb.) şablon farklılıklarına uyum
- **Otomatik doğrulama**: kalem toplamlarının fatura başlığıyla tutarlılık
  kontrolü; BAŞARILI / ŞÜPHELİ / HATALI parse durumları
- **SQLite veritabanı** (`node:sqlite`, sıfır native bağımlılık) + migration
  altyapısı
- **REST API** (Express): belge listeleme/arama/detay, kalem araması, taraf
  (satıcı/alıcı) yönetimi, CRUD uçları
- **Web arayüzü** (framework'süz): Türkçe harf duyarsız arama, gözden geçirme
  kuyruğu, sürükle-bırak **PDF Yükle** sekmesi, açılıp kapatılabilen
  **Düzenleme Modu** (varsayılan read-only)
- **Güvenlik**: varsayılan `127.0.0.1` bind, opsiyonel HTTP Basic Auth
  (`PANEL_USER`/`PANEL_PASS`), same-origin (CSRF) kontrolü, girdi
  doğrulama/whitelist, LIKE joker etkisizleştirme
- **Windows deployment**: `node-windows` ile servis kurulumu (tek UAC onayı),
  otomatik güvenlik duvarı kuralı, Görev Zamanlayıcı ile otomatik ingest ve
  `VACUUM INTO` tabanlı OneDrive yedeği
- **Windows kurulum paketi**: sürüm eklerinde yayınlanan, bağımlılıkları
  paketlenmiş zip + etkileşimli kurulum sihirbazı (`KUR.bat`)

[1.0.0]: https://github.com/yusufarbc/efatura-irsaliye-arsivi/releases/tag/v1.0.0
