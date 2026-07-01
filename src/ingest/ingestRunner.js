#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { pdfToText } = require('./pdfToText');
const { dispatch } = require('./extractors/index');
const { validateDocument } = require('./validate');
const { getDb } = require('../db/db');

// CLI argümanları
const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const fileIdx = args.indexOf('--file');
const dryRunFlag = args.includes('--dry-run');

if (dirIdx === -1 && fileIdx === -1) {
  console.error('Kullanım: node ingestRunner.js --dir <klasör> | --file <dosya.pdf> [--dry-run]');
  process.exit(1);
}

async function run() {
  let pdfFiles = [];

  if (fileIdx !== -1) {
    const filePath = path.resolve(args[fileIdx + 1]);
    if (!fs.existsSync(filePath)) {
      console.error(`Dosya bulunamadı: ${filePath}`);
      process.exit(1);
    }
    pdfFiles = [filePath];
  } else {
    const dir = path.resolve(args[dirIdx + 1]);
    if (!fs.existsSync(dir)) {
      console.error(`Klasör bulunamadı: ${dir}`);
      process.exit(1);
    }
    pdfFiles = findPdfs(dir);
    console.log(`${pdfFiles.length} PDF bulundu: ${dir}`);
  }

  const db = dryRunFlag ? null : getDb();
  const stats = { basarili: 0, supheli: 0, hatali: 0, taninmayan: 0 };
  const taninmayanlar = [];

  for (const pdfPath of pdfFiles) {
    const kaynak_dosya = path.relative(process.cwd(), pdfPath);
    process.stdout.write(`İşleniyor: ${kaynak_dosya} ... `);

    let text;
    try {
      text = await pdfToText(pdfPath);
    } catch (err) {
      console.log(`HATA (pdftotext): ${err.message}`);
      stats.hatali++;
      if (db) saveError(db, kaynak_dosya, err.message);
      continue;
    }

    const dispatched = dispatch(text);
    if (!dispatched) {
      console.log('TANINMAYAN (hiçbir extractor eşleşmedi)');
      stats.taninmayan++;
      taninmayanlar.push(kaynak_dosya);
      continue;
    }

    const { result } = dispatched;
    const { header, items } = result;
    const validation = validateDocument(header, items);

    header.parse_durumu = validation.durum;
    header.parse_notu = validation.notlar.length ? validation.notlar.join('; ') : null;
    header.kaynak_dosya = kaynak_dosya;

    console.log(`${validation.durum} (${items.length} kalem)`);

    if (validation.durum === 'BASARILI') stats.basarili++;
    else stats.supheli++;

    if (!dryRunFlag) {
      upsertDocument(db, header, items);
    }
  }

  console.log('\n=== Özet ===');
  console.log(`BAŞARILI   : ${stats.basarili}`);
  console.log(`ŞÜPHELİ   : ${stats.supheli}`);
  console.log(`HATALI     : ${stats.hatali}`);
  console.log(`TANINMAYAN : ${stats.taninmayan}`);
  if (taninmayanlar.length) {
    console.log('\nTanınmayan dosyalar (yeni extractor gerekebilir):');
    taninmayanlar.forEach((f) => console.log(`  - ${f}`));
  }
}

function findPdfs(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findPdfs(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * VKN/TCKN'ye göre taraflar tablosunda arar; varsa günceller (yeni bilgi
 * varsa doldurur), yoksa oluşturur. Böylece aynı satıcı/alıcı her faturada
 * tekrar tekrar yazılmaz. VKN/TCKN yoksa eşleştirme güvenilir olmadığından
 * her seferinde yeni bir kayıt açılır.
 */
function findOrCreateTaraf(db, fields) {
  const unvan = fields.unvan ?? null;
  const vkn_tckn = fields.vkn_tckn ?? null;
  const vergi_dairesi = fields.vergi_dairesi ?? null;
  const adres = fields.adres ?? null;
  const eposta = fields.eposta ?? null;
  const telefon = fields.telefon ?? null;

  if (!unvan && !vkn_tckn) return null;

  if (vkn_tckn) {
    const existing = db.prepare('SELECT id FROM taraflar WHERE vkn_tckn = ?').get(vkn_tckn);
    if (existing) {
      db.prepare(`
        UPDATE taraflar SET
          unvan = :unvan,
          vergi_dairesi = COALESCE(:vergi_dairesi, vergi_dairesi),
          adres = COALESCE(:adres, adres),
          eposta = COALESCE(:eposta, eposta),
          telefon = COALESCE(:telefon, telefon)
        WHERE id = :id
      `).run({ unvan, vergi_dairesi, adres, eposta, telefon, id: existing.id });
      return existing.id;
    }
  }

  const result = db.prepare(`
    INSERT INTO taraflar (unvan, vkn_tckn, vergi_dairesi, adres, eposta, telefon)
    VALUES (:unvan, :vkn_tckn, :vergi_dairesi, :adres, :eposta, :telefon)
  `).run({ unvan, vkn_tckn, vergi_dairesi, adres, eposta, telefon });

  return Number(result.lastInsertRowid);
}

function upsertDocument(db, header, items) {
  // Aynı ETTN varsa sil-yeniden-yaz
  if (header.ettn) {
    const existing = db.prepare('SELECT id FROM documents WHERE ettn = ?').get(header.ettn);
    if (existing) {
      db.prepare('DELETE FROM documents WHERE id = ?').run(existing.id);
    }
  }

  const satici_id = findOrCreateTaraf(db, {
    unvan: header.satici_unvan,
    vkn_tckn: header.satici_vkn_tckn,
    vergi_dairesi: header.satici_vergi_dairesi,
    adres: header.satici_adres,
    eposta: header.satici_eposta,
    telefon: header.satici_telefon,
  });
  const alici_id = findOrCreateTaraf(db, {
    unvan: header.alici_unvan,
    vkn_tckn: header.alici_vkn_tckn,
    vergi_dairesi: header.alici_vergi_dairesi,
    adres: header.alici_adres,
    eposta: header.alici_eposta,
    telefon: header.alici_telefon,
  });

  const insertDoc = db.prepare(`
    INSERT INTO documents (
      belge_tipi, belge_no, ettn, duzenleme_tarihi, duzenleme_zamani,
      senaryo, fatura_tipi, satici_id, alici_id,
      mal_hizmet_toplam_tutari, hesaplanan_kdv_toplam, vergiler_dahil_toplam_tutar, odenecek_tutar,
      notlar, kaynak_dosya, parse_durumu, parse_notu
    ) VALUES (
      :belge_tipi, :belge_no, :ettn, :duzenleme_tarihi, :duzenleme_zamani,
      :senaryo, :fatura_tipi, :satici_id, :alici_id,
      :mal_hizmet_toplam_tutari, :hesaplanan_kdv_toplam, :vergiler_dahil_toplam_tutar, :odenecek_tutar,
      :notlar, :kaynak_dosya, :parse_durumu, :parse_notu
    )
  `);

  const insertItem = db.prepare(`
    INSERT INTO items (document_id, sira_no, aciklama, miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari)
    VALUES (:document_id, :sira_no, :aciklama, :miktar, :birim, :birim_fiyat, :kdv_orani, :kdv_tutari, :mal_hizmet_tutari)
  `);

  db.exec('BEGIN');
  try {
    const result = insertDoc.run({
      belge_tipi: header.belge_tipi,
      belge_no: header.belge_no,
      ettn: header.ettn,
      duzenleme_tarihi: header.duzenleme_tarihi,
      duzenleme_zamani: header.duzenleme_zamani,
      senaryo: header.senaryo,
      fatura_tipi: header.fatura_tipi,
      satici_id,
      alici_id,
      mal_hizmet_toplam_tutari: header.mal_hizmet_toplam_tutari,
      hesaplanan_kdv_toplam: header.hesaplanan_kdv_toplam,
      vergiler_dahil_toplam_tutar: header.vergiler_dahil_toplam_tutar,
      odenecek_tutar: header.odenecek_tutar,
      notlar: header.notlar,
      kaynak_dosya: header.kaynak_dosya,
      parse_durumu: header.parse_durumu,
      parse_notu: header.parse_notu,
    });
    const document_id = Number(result.lastInsertRowid);
    for (const item of items) {
      insertItem.run({ ...item, document_id });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function saveError(db, kaynak_dosya, mesaj) {
  // Dosya adından belge tipini tahmin et; bilinmiyorsa FATURA varsayılan
  const lower = kaynak_dosya.toLowerCase();
  const belge_tipi = lower.includes('irsaliye') ? 'IRSALIYE' : 'FATURA';
  db.prepare(`
    INSERT INTO documents (belge_tipi, kaynak_dosya, parse_durumu, parse_notu)
    VALUES (?, ?, 'HATALI', ?)
  `).run(belge_tipi, kaynak_dosya, mesaj);
}

run().catch((err) => {
  console.error('Beklenmedik hata:', err);
  process.exit(1);
});
