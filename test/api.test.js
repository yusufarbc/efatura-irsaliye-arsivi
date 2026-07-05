'use strict';

// API entegrasyon testi: geçici bir SQLite dosyası üzerinde gerçek Express
// uygulamasını ayağa kaldırıp okuma + CRUD + güvenlik davranışlarını doğrular.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'efatura-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');
process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');

const app = require('../src/server/app');
const { getDb } = require('../src/db/db');

let server;
let base;

before(async () => {
  const db = getDb();

  const taraf = db.prepare(
    "INSERT INTO taraflar (unvan, vkn_tckn, vergi_dairesi) VALUES ('ÖRNEK BİLİŞİM A.Ş.', '1234567890', 'Merkez')"
  ).run();
  const tarafId = Number(taraf.lastInsertRowid);

  const doc = db.prepare(`
    INSERT INTO documents (belge_tipi, belge_no, ettn, duzenleme_tarihi, satici_id,
      mal_hizmet_toplam_tutari, hesaplanan_kdv_toplam, kaynak_dosya, parse_durumu)
    VALUES ('FATURA', 'TST2026000000001', 'a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6', '2026-06-30', ?,
      15000, 3000, 'test.pdf', 'BASARILI')
  `).run(tarafId);
  const docId = Number(doc.lastInsertRowid);

  db.prepare(`
    INSERT INTO items (document_id, sira_no, aciklama, miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari)
    VALUES (?, 1, 'Siber Güvenlik Danışmanlığı', 1, 'Adet', 15000, 20, 3000, 15000)
  `).run(docId);

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows WAL kilidi */ }
});

async function get(url) {
  const res = await fetch(base + url);
  return { status: res.status, json: await res.json() };
}
async function send(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

// --- Okuma ---

test('GET /api/documents: listeler', async () => {
  const { status, json } = await get('/api/documents');
  assert.equal(status, 200);
  assert.equal(json.total, 1);
  assert.equal(json.data[0].belge_no, 'TST2026000000001');
  assert.equal(json.data[0].satici_unvan, 'ÖRNEK BİLİŞİM A.Ş.');
});

test('GET /api/documents: geçersiz limit 500 hatası üretmez, sıkıştırılır', async () => {
  const { status, json } = await get('/api/documents?limit=abc&offset=xyz');
  assert.equal(status, 200);
  assert.equal(json.limit, 50);
  assert.equal(json.offset, 0);
});

test('GET /api/items: Türkçe harf duyarsız arama (GÜVENLİK → Güvenlik)', async () => {
  const { status, json } = await get('/api/items?q=' + encodeURIComponent('GÜVENLİK'));
  assert.equal(status, 200);
  assert.equal(json.total, 1);
});

test('GET /api/items: LIKE joker karakterleri etkisiz (%% her şeyi döndürmez)', async () => {
  const { json } = await get('/api/items?q=' + encodeURIComponent('%%'));
  assert.equal(json.total, 0);
});

test('GET /api/bilinmeyen: JSON 404 döner (HTML fallback değil)', async () => {
  const { status, json } = await get('/api/bilinmeyen');
  assert.equal(status, 404);
  assert.ok(json.error);
});

// --- Güvenlik ---

test('cross-origin yazma isteği 403 ile reddedilir', async () => {
  const { status } = await send('PATCH', '/api/documents/1', { belge_no: 'HACK' }, { Origin: 'http://evil.example' });
  assert.equal(status, 403);
});

test('same-origin yazma isteği kabul edilir', async () => {
  const { status } = await send('PATCH', '/api/documents/1', { notlar: 'test notu' }, { Origin: base });
  assert.equal(status, 200);
});

// --- CRUD ---

test('PATCH /api/documents/:id: whitelist dışı alan reddedilir', async () => {
  const { status, json } = await send('PATCH', '/api/documents/1', { kaynak_dosya: 'sahte.pdf' });
  assert.equal(status, 400);
  assert.ok(json.detaylar.some((d) => d.includes('bilinmeyen alan')));
});

test('PATCH /api/documents/:id: geçersiz tarih reddedilir', async () => {
  const { status } = await send('PATCH', '/api/documents/1', { duzenleme_tarihi: '30-06-2026' });
  assert.equal(status, 400);
});

test('PATCH /api/documents/:id: geçerli güncelleme çalışır', async () => {
  // odenecek_tutar Türkçe formatlı string olarak da kabul edilmeli (panel girdisi)
  const { status } = await send('PATCH', '/api/documents/1', { belge_no: 'TST-DUZELTME', odenecek_tutar: '18000,00' });
  assert.equal(status, 200);
  const { json } = await get('/api/documents/1');
  assert.equal(json.belge_no, 'TST-DUZELTME');
});

test('PATCH /api/taraflar/:id: unvan düzeltmesi belgeye yansır', async () => {
  const detay = await get('/api/documents/1');
  const tarafId = detay.json.satici_id;
  const { status } = await send('PATCH', `/api/taraflar/${tarafId}`, { unvan: 'ÖRNEK BİLİŞİM ANONİM ŞİRKETİ' });
  assert.equal(status, 200);
  const { json } = await get('/api/documents/1');
  assert.equal(json.satici_unvan, 'ÖRNEK BİLİŞİM ANONİM ŞİRKETİ');
});

test('kalem CRUD + revalidate akışı', async () => {
  // Yeni kalem ekle → toplam artık tutmaz
  const eklenen = await send('POST', '/api/documents/1/items', {
    aciklama: 'Ek Hizmet', miktar: 1, birim: 'Adet', birim_fiyat: 1000, kdv_orani: 20, kdv_tutari: 200, mal_hizmet_tutari: 1000,
  });
  assert.equal(eklenen.status, 201);
  assert.equal(eklenen.json.sira_no, 2); // otomatik sıra no

  const reval1 = await send('POST', '/api/documents/1/revalidate');
  assert.equal(reval1.json.parse_durumu, 'SUPHELI');

  // Başlık toplamlarını düzelt → yeniden doğrula → BASARILI
  await send('PATCH', '/api/documents/1', { mal_hizmet_toplam_tutari: 16000, hesaplanan_kdv_toplam: 3200 });
  const reval2 = await send('POST', '/api/documents/1/revalidate');
  assert.equal(reval2.json.parse_durumu, 'BASARILI');

  // Kalemi güncelle
  const patch = await send('PATCH', `/api/items/${eklenen.json.id}`, { aciklama: 'Ek Danışmanlık Hizmeti' });
  assert.equal(patch.status, 200);
  assert.equal(patch.json.aciklama, 'Ek Danışmanlık Hizmeti');

  // Kalemi sil
  const del = await send('DELETE', `/api/items/${eklenen.json.id}`);
  assert.equal(del.status, 200);
  const detay = await get('/api/documents/1');
  assert.equal(detay.json.items.length, 1);
});

test('DELETE /api/documents/:id: belge ve kalemleri siler', async () => {
  const db = getDb();
  const doc = db.prepare(`
    INSERT INTO documents (belge_tipi, kaynak_dosya, parse_durumu) VALUES ('FATURA', 'silinecek.pdf', 'HATALI')
  `).run();
  const docId = Number(doc.lastInsertRowid);
  db.prepare('INSERT INTO items (document_id, aciklama) VALUES (?, ?)').run(docId, 'yetim kalmamalı');

  const del = await send('DELETE', `/api/documents/${docId}`);
  assert.equal(del.status, 200);

  const { status } = await get(`/api/documents/${docId}`);
  assert.equal(status, 404);
  const kalan = db.prepare('SELECT COUNT(*) as c FROM items WHERE document_id = ?').get(docId);
  assert.equal(kalan.c, 0); // ON DELETE CASCADE çalıştı
});

test('PATCH /api/items/:id: olmayan kalem 404', async () => {
  const { status } = await send('PATCH', '/api/items/99999', { aciklama: 'x' });
  assert.equal(status, 404);
});

// --- Upload ---

async function upload(filename, buffer) {
  const res = await fetch(base + '/api/upload?filename=' + encodeURIComponent(filename), {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
  });
  return { status: res.status, json: await res.json() };
}

test('POST /api/upload: PDF olmayan içerik reddedilir', async () => {
  const { status, json } = await upload('sahte.pdf', Buffer.from('bu bir pdf degil'));
  assert.equal(status, 400);
  assert.match(json.error, /PDF/);
});

test('POST /api/upload: boş gövde reddedilir', async () => {
  const { status } = await upload('bos.pdf', Buffer.alloc(0));
  assert.equal(status, 400);
});

test('POST /api/upload: path traversal dosya adı etkisiz, dosya uploads içinde kalır', async () => {
  // %PDF- ile başlayan ama gerçek olmayan gövde: dosya kaydedilir,
  // pdftotext aşaması HATALI döner (veya poppler yoksa hata mesajı) — ama
  // path traversal denemesi uploads klasörü dışına asla yazamamalı.
  const { status, json } = await upload('..\\..\\onemli\\..\\zararli.pdf', Buffer.from('%PDF-1.4 gecersiz icerik'));
  assert.ok(status === 200 || status === 422, `beklenmeyen durum: ${status}`);
  assert.ok(['HATALI', 'TANINMAYAN'].includes(json.durum), `durum: ${json.durum}`);
  assert.equal(json.dosya.includes('..'), false);
  const yazilan = fs.readdirSync(path.join(tmpDir, 'uploads'));
  assert.equal(yazilan.length, 1);
  assert.match(yazilan[0], /zararli.*\.pdf$/);
});
