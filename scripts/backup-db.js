'use strict';

// SQLite veritabanının tutarlı bir anlık görüntüsünü (snapshot) alıp OneDrive
// klasörüne yazar. Canlı .sqlite dosyasını doğrudan kopyalamak/senkronlamak
// WAL modunda güvenli DEĞİLDİR (verinin bir kısmı -wal dosyasındadır ve yazma
// sırasında alınan kopya bozuk olabilir); VACUUM INTO ise SQLite'ın kendi
// mekanizmasıyla tek dosyalık tutarlı bir kopya üretir.
//
// Kullanım: npm run backup
//   BACKUP_DIR  → hedef klasör (varsayılan: %OneDrive%\EFaturaArsivYedek)
//   BACKUP_KEEP → tutulacak yedek sayısı (varsayılan: 14, eskiler silinir)
//   DB_PATH     → kaynak DB (varsayılan: data/arsiv.sqlite)

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'arsiv.sqlite');
const BACKUP_DIR = process.env.BACKUP_DIR ||
  (process.env.OneDrive ? path.join(process.env.OneDrive, 'EFaturaArsivYedek') : null);
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP, 10) || 14);

if (!BACKUP_DIR) {
  console.error('Hedef klasör belirlenemedi: OneDrive ortam değişkeni yok. BACKUP_DIR ayarlayın.');
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error(`Veritabanı bulunamadı: ${DB_PATH}`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

// arsiv-2026-07-05-2100.sqlite gibi zaman damgalı ad
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const hedef = path.join(BACKUP_DIR, `arsiv-${stamp}.sqlite`);

if (fs.existsSync(hedef)) fs.rmSync(hedef); // aynı dakikada iki kez çalıştıysa

// Önce .tmp'ye yaz, bitince adlandır — OneDrive yarım dosyayı senkronlamasın
const tmp = hedef + '.tmp';
if (fs.existsSync(tmp)) fs.rmSync(tmp);

const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
} finally {
  db.close();
}
fs.renameSync(tmp, hedef);

const boyut = (fs.statSync(hedef).size / 1024 / 1024).toFixed(2);
console.log(`Yedek alındı: ${hedef} (${boyut} MB)`);

// Eski yedekleri temizle (en yeni KEEP adet kalır)
const eskiler = fs.readdirSync(BACKUP_DIR)
  .filter((f) => /^arsiv-.*\.sqlite$/.test(f))
  .sort()            // zaman damgalı adlar alfabetik = kronolojik
  .reverse()
  .slice(KEEP);

for (const f of eskiler) {
  fs.rmSync(path.join(BACKUP_DIR, f));
  console.log(`Eski yedek silindi: ${f}`);
}
console.log(`Toplam tutulan yedek: en fazla ${KEEP}`);
