#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { ingestPdf } = require('./ingestCore');
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

    const sonuc = await ingestPdf(db, pdfPath, kaynak_dosya);

    if (sonuc.durum === 'TANINMAYAN') {
      console.log('TANINMAYAN (hiçbir extractor eşleşmedi)');
      stats.taninmayan++;
      taninmayanlar.push(kaynak_dosya);
    } else if (sonuc.durum === 'HATALI') {
      console.log(`HATA: ${sonuc.mesaj}`);
      stats.hatali++;
    } else {
      console.log(`${sonuc.durum} (${sonuc.kalem_sayisi} kalem)`);
      if (sonuc.durum === 'BASARILI') stats.basarili++;
      else stats.supheli++;
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

run().catch((err) => {
  console.error('Beklenmedik hata:', err);
  process.exit(1);
});
