# Güvenlik Politikası

## Desteklenen sürümler

| Sürüm | Destek |
| ----- | ------ |
| 1.x   | ✅     |

## Güvenlik açığı bildirimi

Lütfen güvenlik açıklarını **herkese açık issue olarak açmayın**. Bunun
yerine GitHub'ın gizli bildirim kanalını kullanın:

**[Security Advisories → Report a vulnerability](https://github.com/yusufarbc/efatura-irsaliye-arsivi/security/advisories/new)**

Bildirimlere en geç 7 gün içinde dönüş yapılmaya çalışılır.

## Kapsam ve tasarım notları

- Sunucu varsayılan olarak yalnızca `127.0.0.1`'e bağlanır; ağa açmak bilinçli
  bir tercihtir (`HOST=0.0.0.0`) ve parola koruması (`PANEL_USER`/`PANEL_PASS`)
  önerilir.
- Yazma isteklerinde same-origin (CSRF) kontrolü; tüm yazma alanlarında
  whitelist + tip doğrulaması; arama girdilerinde LIKE joker etkisizleştirme
  uygulanır.
- Bu yazılım KVKK kapsamında **kişisel veri** (VKN/TCKN, ad-soyad, adres)
  işler. Veritabanı ve belge klasörleri depoya asla dahil edilmez
  (`.gitignore`). Katkılarda gerçek kişisel veri içeren örnekler kabul
  edilmez — fixture'lar maskelenmiş olmalıdır.
